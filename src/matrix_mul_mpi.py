#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Program Studi Informatika - Fakultas Teknik, Universitas Siliwangi
----------------------------------------------------------------------------------------
Judul:
  Analisis Waktu Komputasi dan Overhead Komunikasi pada Perkalian Matriks 4096 x 4096
  Terdistribusi Menggunakan MPI4Py

Deskripsi:
  Program perkalian matriks C = A x B terdistribusi dengan dekomposisi baris 1D
  (Row-wise Block Decomposition) menggunakan MPI4Py. Mendukung sembarang ukuran
  matriks N dan sembarang jumlah proses P (menggunakan Scatterv & Gatherv).
  Dilengkapi pencatatan waktu komputasi murni (T_comp), waktu komunikasi (T_comm),
  total waktu (T_total), validasi checksum numerik, dan ekspor metrik ke CSV.
========================================================================================
"""

import sys
import os

# PENTING untuk Benchmarking HPC:
# Batasi thread internal BLAS/LAPACK (OpenBLAS/MKL) ke 1 thread per proses MPI
# agar tidak terjadi CPU thread oversubscription / contention, sehingga
# Speedup dan Efisiensi paralel antar-proses MPI terukur secara murni dan valid.
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

import argparse
import time
import numpy as np
from mpi4py import MPI


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Perkalian Matriks Terdistribusi 4096x4096 dengan MPI4Py"
    )
    parser.add_argument(
        "--size", "-n",
        type=int,
        default=4096,
        help="Ukuran dimensi matriks N x N (default: 4096)"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed untuk reprodusibilitas inisialisasi matriks (default: 42)"
    )
    parser.add_argument(
        "--csv",
        type=str,
        default=None,
        help="Jalur file CSV untuk menyimpan rekaman benchmark (misal: results/benchmark_results.csv)"
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Simpan matriks hasil C ke format .npy (opsional)"
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Bandingkan hasil dengan perkalian sekuensial NumPy (disarankan untuk N <= 2048)"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Minimalisir output terminal (hanya ringkasan)"
    )
    return parser.parse_args()


def calculate_split(n, size):
    """
    Menghitung pembagian baris untuk tiap rank secara merata menggunakan block distribution.
    Mendukung kasus di mana n tidak habis dibagi size.
    """
    rows_per_proc = [n // size + (1 if i < (n % size) else 0) for i in range(size)]
    displs_rows = [sum(rows_per_proc[:i]) for i in range(size)]
    
    # Konversi baris ke jumlah elemen float32 (dikali N)
    send_counts_elem = [r * n for r in rows_per_proc]
    displs_elem = [d * n for d in displs_rows]
    
    return rows_per_proc, displs_rows, send_counts_elem, displs_elem


def main():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    args = parse_arguments()
    N = args.size
    seed = args.seed

    # ---------------------------------------------------------
    # 1. Perhitungan Pembagian Kerja (Partitioning)
    # ---------------------------------------------------------
    rows_per_proc, displs_rows, send_counts_elem, displs_elem = calculate_split(N, size)
    local_rows = rows_per_proc[rank]

    # Inisialisasi variabel matriks
    A = None
    B = None
    C = None

    if rank == 0:
        if not args.quiet:
            print("=" * 80)
            print(" " * 15 + "BENCHMARK PERKALIAN MATRIKS TERDISTRIBUSI MPI4PY")
            print("=" * 80)
            print(f"[*] Ukuran Matriks   : {N} x {N} (Float32)")
            print(f"[*] Total Elemen     : {N * N:,} elemen per matriks (~{(N * N * 4) / (1024**2):.2f} MB)")
            print(f"[*] Jumlah Proses (P): {size} proses/rank")
            print(f"[*] Distribusi Baris : Min={min(rows_per_proc)} baris, Max={max(rows_per_proc)} baris per rank")
            print(f"[*] Seed Random      : {seed}")
            print("-" * 80)
            print("[*] Inisialisasi Matriks A dan B di Master (Rank 0)...")

        t_init_start = time.time()
        np.random.seed(seed)
        # Gunakan float32 agar hemat memori dan perkalian efisien
        A = np.random.rand(N, N).astype(np.float32)
        B = np.random.rand(N, N).astype(np.float32)
        C = np.empty((N, N), dtype=np.float32)
        t_init = time.time() - t_init_start

        if not args.quiet:
            print(f"[+] Inisialisasi matriks selesai dalam {t_init:.4f} detik.")
            print("[*] Memulai fase komputasi paralel dan pengukuran waktu...\n")
    else:
        # Buffer penerima B di worker
        B = np.empty((N, N), dtype=np.float32)

    # Alokasi buffer lokal per rank
    local_A = np.empty((local_rows, N), dtype=np.float32)
    local_C = np.empty((local_rows, N), dtype=np.float32)

    # Sinkronisasi sebelum memulai pengukuran waktu benchmark
    comm.Barrier()
    t_global_start = MPI.Wtime()

    # ---------------------------------------------------------
    # 2. Fase Komunikasi Input (Broadcast B & Scatterv A)
    # ---------------------------------------------------------
    t_comm_in_start = MPI.Wtime()

    # Broadcast Matriks B ke seluruh rank (collective communication)
    comm.Bcast(B, root=0)

    # Scatter baris-baris Matriks A ke masing-masing rank
    # Menggunakan Scatterv untuk fleksibilitas ukuran pembagian (arbitrary P)
    comm.Scatterv([A, send_counts_elem, displs_elem, MPI.FLOAT], local_A, root=0)

    t_comm_in_local = MPI.Wtime() - t_comm_in_start

    # ---------------------------------------------------------
    # 3. Fase Komputasi Murni (Local Matrix Multiplication)
    # ---------------------------------------------------------
    comm.Barrier()
    t_comp_start = MPI.Wtime()

    # Perkalian submatriks lokal: local_C = local_A x B
    # Menggunakan np.matmul (BLAS teroptimasi)
    np.matmul(local_A, B, out=local_C)

    t_comp_local = MPI.Wtime() - t_comp_start

    # ---------------------------------------------------------
    # 4. Fase Komunikasi Output (Gatherv submatriks local_C)
    # ---------------------------------------------------------
    comm.Barrier()
    t_comm_out_start = MPI.Wtime()

    # Kumpulkan seluruh submatriks C dari seluruh rank kembali ke Master (Rank 0)
    comm.Gatherv(local_C, [C, send_counts_elem, displs_elem, MPI.FLOAT], root=0)

    t_comm_out_local = MPI.Wtime() - t_comm_out_start

    # Sinkronisasi akhir
    comm.Barrier()
    t_global_end = MPI.Wtime()
    t_total_local = t_global_end - t_global_start
    t_comm_local = t_comm_in_local + t_comm_out_local

    # ---------------------------------------------------------
    # 5. Agregasi Metrik Performa Antar-Proses
    # ---------------------------------------------------------
    # Kumpulkan max dan avg untuk memotret latency/straggler effect
    t_comp_max = comm.reduce(t_comp_local, op=MPI.MAX, root=0)
    t_comp_min = comm.reduce(t_comp_local, op=MPI.MIN, root=0)
    t_comp_sum = comm.reduce(t_comp_local, op=MPI.SUM, root=0)

    t_comm_max = comm.reduce(t_comm_local, op=MPI.MAX, root=0)
    t_comm_min = comm.reduce(t_comm_local, op=MPI.MIN, root=0)
    t_comm_sum = comm.reduce(t_comm_local, op=MPI.SUM, root=0)

    t_comm_in_max = comm.reduce(t_comm_in_local, op=MPI.MAX, root=0)
    t_comm_out_max = comm.reduce(t_comm_out_local, op=MPI.MAX, root=0)

    t_total_max = comm.reduce(t_total_local, op=MPI.MAX, root=0)

    # ---------------------------------------------------------
    # 6. Pelaporan Hasil dan Validasi di Master (Rank 0)
    # ---------------------------------------------------------
    if rank == 0:
        t_comp_avg = t_comp_sum / size
        t_comm_avg = t_comm_sum / size

        # Verifikasi numerik sederhana: Checksum & Frobenius Norm
        frob_norm = float(np.linalg.norm(C))
        sample_sum = float(np.sum(C[0:min(5, N), 0:min(5, N)]))

        # Throughput (GFLOPS): 2 * N^3 operasi floating-point untuk matriks N x N
        # (N baris * N kolom * (N perkalian + N penjumlahan))
        total_flops = 2.0 * (N ** 3)
        gflops = (total_flops / t_total_max) / 1e9

        print("=" * 80)
        print(" " * 27 + "HASIL PENGUJIAN PERFORMA")
        print("=" * 80)
        print(f"Ukuran Matriks (N)           : {N} x {N}")
        print(f"Jumlah Proses / Core (P)     : {size}")
        print(f"Total Waktu Eksekusi (T_total): {t_total_max:.4f} detik")
        print(f"  ├─ Waktu Komputasi (T_comp) : {t_comp_max:.4f} detik  (Avg: {t_comp_avg:.4f}s, Min: {t_comp_min:.4f}s)")
        print(f"  └─ Overhead Komunikasi(T_comm): {t_comm_max:.4f} detik  (Avg: {t_comm_avg:.4f}s, Min: {t_comm_min:.4f}s)")
        print(f"      ├─ Transfer In (Scatter+Bcast): {t_comm_in_max:.4f} detik")
        print(f"      └─ Transfer Out (Gather)      : {t_comm_out_max:.4f} detik")
        
        ratio_comp = (t_comp_max / t_total_max) * 100 if t_total_max > 0 else 0
        ratio_comm = (t_comm_max / t_total_max) * 100 if t_total_max > 0 else 0
        print(f"Rasio Waktu Komputasi        : {ratio_comp:.2f}%")
        print(f"Rasio Overhead Komunikasi    : {ratio_comm:.2f}% (Communication Bottleneck)")
        print(f"Throughput Performa          : {gflops:.2f} GFLOPS")
        print("-" * 80)
        print("VERIFIKASI INTEGRITAS HASIL:")
        print(f"  ├─ Frobenius Norm Matriks C : {frob_norm:.6e}")
        print(f"  ├─ Checksum Sampel (C[:5,:5]): {sample_sum:.6e}")
        print(f"  └─ Sampel C[0:3, 0:3]:\n{C[0:min(3, N), 0:min(3, N)]}")

        # Verifikasi opsional dengan perkalian sekuensial NumPy
        if args.verify:
            print("\n[*] Menjalankan verifikasi sekuensial (NumPy A @ B)...")
            t_seq_start = time.time()
            C_seq = np.matmul(A, B)
            t_seq = time.time() - t_seq_start
            is_valid = np.allclose(C, C_seq, atol=1e-3, rtol=1e-3)
            print(f"[+] Verifikasi Valid?        : {'SUKSES (IDENTIK)' if is_valid else 'GAGAL'}")
            print(f"[+] Waktu NumPy Sekuensial   : {t_seq:.4f} detik")

        # Opsi simpan matriks ke disk
        if args.save:
            output_file = f"matrix_C_{N}x{N}_P{size}.npy"
            np.save(output_file, C)
            print(f"[+] Matriks C berhasil disimpan ke: {output_file}")

        print("=" * 80)

        # ---------------------------------------------------------
        # 7. Ekspor ke File CSV jika diminta
        # ---------------------------------------------------------
        if args.csv:
            os.makedirs(os.path.dirname(os.path.abspath(args.csv)), exist_ok=True)
            file_exists = os.path.isfile(args.csv)
            with open(args.csv, mode="a", encoding="utf-8") as f:
                if not file_exists:
                    # Tulis header
                    f.write("timestamp,matrix_size,processes,t_total_s,t_comp_max_s,t_comp_avg_s,"
                            "t_comm_max_s,t_comm_avg_s,t_comm_in_s,t_comm_out_s,"
                            "comp_percent,comm_percent,gflops,frob_norm\n")
                f.write(
                    f"{time.strftime('%Y-%m-%d %H:%M:%S')},{N},{size},{t_total_max:.6f},"
                    f"{t_comp_max:.6f},{t_comp_avg:.6f},{t_comm_max:.6f},{t_comm_avg:.6f},"
                    f"{t_comm_in_max:.6f},{t_comm_out_max:.6f},{ratio_comp:.2f},{ratio_comm:.2f},"
                    f"{gflops:.2f},{frob_norm:.6e}\n"
                )
            if not args.quiet:
                print(f"[+] Data benchmark berhasil ditambahkan ke CSV: {args.csv}")


if __name__ == "__main__":
    main()
