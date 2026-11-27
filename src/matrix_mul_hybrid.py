#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Program Perkalian Matriks Hybrid MPI + OpenMP (Distributed-Shared Memory)
----------------------------------------------------------------------------------------
Sesuai Tema 3: "menggunakan MPI dan OpenMP dengan distribusi beban kerja antar prosesor."

Arsitektur Hybrid:
  - Level 1 (Distributed Memory): MPI mendistribusikan partisi baris matriks antar proses
    (Block Row Partitioning via Scatterv & Bcast).
  - Level 2 (Shared Memory): Setiap proses MPI memanfaatkan multi-threading OpenMP/BLAS
    (OMP_NUM_THREADS / OPENBLAS_NUM_THREADS) di memori lokal node tersebut.
========================================================================================
"""

import argparse
import os
import time


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Perkalian Matriks Hybrid MPI + OpenMP (4096 x 4096)"
    )
    parser.add_argument("--size", "-n", type=int, default=4096, help="Ukuran matriks N x N (default: 4096)")
    parser.add_argument("--threads", "-t", type=int, default=2, help="Jumlah thread OpenMP per proses MPI (default: 2)")
    parser.add_argument("--seed", type=int, default=42, help="Seed random generator (default: 42)")
    parser.add_argument(
        "--csv",
        type=str,
        default="results/hybrid_mpi_openmp_results.csv",
        help="File CSV rekapitulasi hasil pengujian hybrid",
    )
    return parser.parse_args()


# Parse argumen & set variabel OpenMP SEBELUM import numpy/BLAS
args = parse_arguments()
num_threads = max(1, args.threads)

os.environ["OMP_NUM_THREADS"] = str(num_threads)
os.environ["OPENBLAS_NUM_THREADS"] = str(num_threads)
os.environ["MKL_NUM_THREADS"] = str(num_threads)
os.environ["VECLIB_MAXIMUM_THREADS"] = str(num_threads)
os.environ["NUMEXPR_NUM_THREADS"] = str(num_threads)

import numpy as np
from mpi4py import MPI


def calculate_split(n, size):
    rows_per_proc = [n // size + (1 if i < (n % size) else 0) for i in range(size)]
    displs_rows = [sum(rows_per_proc[:i]) for i in range(size)]
    send_counts_elem = [r * n for r in rows_per_proc]
    displs_elem = [d * n for d in displs_rows]
    return rows_per_proc, displs_rows, send_counts_elem, displs_elem


def main():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    N = args.size
    total_workers = size * num_threads

    rows_per_proc, _, send_counts_elem, displs_elem = calculate_split(N, size)
    local_rows = rows_per_proc[rank]

    A = None
    B = None
    C = None

    if rank == 0:
        print("=" * 80)
        print(" " * 18 + "HYBRID MPI + OPENMP MATRIX MULTIPLICATION")
        print("=" * 80)
        print(f"[*] Ukuran Matriks         : {N} x {N} (Float32)")
        print(f"[*] Jumlah Proses MPI (P)  : {size} proses")
        print(f"[*] Thread OpenMP per Node : {num_threads} threads")
        print(f"[*] Total Komputasi Cores  : {total_workers} (P x T)")
        print("-" * 80)
        t_init_start = time.time()
        np.random.seed(args.seed)
        A = np.random.rand(N, N).astype(np.float32)
        B = np.random.rand(N, N).astype(np.float32)
        C = np.empty((N, N), dtype=np.float32)
        print(f"[+] Inisialisasi data selesai ({time.time() - t_init_start:.4f} detik).\n")
    else:
        B = np.empty((N, N), dtype=np.float32)

    local_A = np.empty((local_rows, N), dtype=np.float32)
    local_C = np.empty((local_rows, N), dtype=np.float32)

    comm.Barrier()
    t_global_start = MPI.Wtime()

    # 1. MPI Communication Input
    t_comm_in_start = MPI.Wtime()
    comm.Bcast(B, root=0)
    comm.Scatterv([A, send_counts_elem, displs_elem, MPI.FLOAT], local_A, root=0)
    t_comm_in_local = MPI.Wtime() - t_comm_in_start

    # 2. Hybrid OpenMP Local Computation
    comm.Barrier()
    t_comp_start = MPI.Wtime()
    np.matmul(local_A, B, out=local_C)
    t_comp_local = MPI.Wtime() - t_comp_start

    # 3. MPI Communication Output
    comm.Barrier()
    t_comm_out_start = MPI.Wtime()
    comm.Gatherv(local_C, [C, send_counts_elem, displs_elem, MPI.FLOAT], root=0)
    t_comm_out_local = MPI.Wtime() - t_comm_out_start

    comm.Barrier()
    t_total_local = MPI.Wtime() - t_global_start

    t_comp_max = comm.reduce(t_comp_local, op=MPI.MAX, root=0)
    t_comm_max = comm.reduce(t_comm_in_local + t_comm_out_local, op=MPI.MAX, root=0)
    t_total_max = comm.reduce(t_total_local, op=MPI.MAX, root=0)

    if rank == 0:
        total_flops = 2.0 * (N ** 3)
        gflops = (total_flops / t_total_max) / 1e9 if t_total_max > 0 else 0.0
        frob_norm = float(np.linalg.norm(C))
        comp_pct = (t_comp_max / t_total_max) * 100 if t_total_max > 0 else 0.0
        comm_pct = (t_comm_max / t_total_max) * 100 if t_total_max > 0 else 0.0

        print("=" * 80)
        print(" " * 27 + "HASIL PENGUJIAN HYBRID")
        print("=" * 80)
        print(f"Total Waktu Eksekusi (T_total): {t_total_max:.4f} detik")
        print(f"  ├─ Waktu Komputasi (T_comp) : {t_comp_max:.4f} detik ({comp_pct:.2f}%) [OpenMP]")
        print(f"  └─ Overhead Komunikasi(T_comm): {t_comm_max:.4f} detik ({comm_pct:.2f}%) [MPI]")
        print(f"Throughput Performa          : {gflops:.2f} GFLOPS")
        print(f"Verifikasi Frobenius Norm    : {frob_norm:.6e}")
        print("=" * 80)

        if args.csv:
            os.makedirs(os.path.dirname(os.path.abspath(args.csv)), exist_ok=True)
            file_exists = os.path.isfile(args.csv)
            with open(args.csv, "a", encoding="utf-8") as f:
                if not file_exists:
                    f.write(
                        "matrix_size,mpi_procs,omp_threads,total_cores,"
                        "t_total_s,t_comp_s,t_comm_s,comp_pct,comm_pct,gflops\n"
                    )
                f.write(
                    f"{N},{size},{num_threads},{total_workers},"
                    f"{t_total_max:.6f},{t_comp_max:.6f},{t_comm_max:.6f},"
                    f"{comp_pct:.2f},{comm_pct:.2f},{gflops:.2f}\n"
                )
            print(f"[+] Rekaman tersimpan ke {args.csv}")


if __name__ == "__main__":
    main()
