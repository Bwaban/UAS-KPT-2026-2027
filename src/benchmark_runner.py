#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Script Otomasi Pengujian Benchmark & Scaling (Strong & Weak Scaling)
----------------------------------------------------------------------------------------
Fungsi:
  1. Menjalankan benchmark matrix_mul_mpi.py secara berurutan untuk variasi proses
     P = [1, 2, 4, 8, 16] (Cross-platform Windows MS-MPI / Linux OpenMPI).
  2. Merekam waktu eksekusi sekuensial (T_seq) sebagai baseline.
  3. Menghitung Speedup Ratio (S = T_seq / T_paralel) dan Efficiency (E = S / P).
  4. Menganalisis Strong Scaling (N konstan 4096) dan Weak Scaling.
  5. Menyimpan rekapitulasi ke file CSV dan memicu pembuatan grafik analisis.
========================================================================================
"""

import sys
import os
import argparse
import subprocess
import shutil
import pandas as pd
import numpy as np


def detect_mpi_command():
    """Mendeteksi ketersediaan executable mpiexec atau mpirun."""
    for cmd in ["mpiexec", "mpirun"]:
        if shutil.which(cmd) is not None:
            return cmd
    return None


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Otomasi Pengujian Benchmark MPI4Py (Strong & Weak Scaling)"
    )
    parser.add_argument(
        "--processes", "-p",
        nargs="+",
        type=int,
        default=[1, 2, 4, 8, 16],
        help="Daftar variasi jumlah proses MPI (default: 1 2 4 8 16)"
    )
    parser.add_argument(
        "--size", "-n",
        type=int,
        default=4096,
        help="Ukuran dimensi matriks N x N untuk Strong Scaling (default: 4096)"
    )
    parser.add_argument(
        "--weak-scaling",
        action="store_true",
        help="Jalankan juga uji Weak Scaling (beban kerja per proses konstan)"
    )
    parser.add_argument(
        "--output-csv",
        type=str,
        default="results/benchmark_results.csv",
        help="File CSV tujuan pencatatan benchmark (default: results/benchmark_results.csv)"
    )
    parser.add_argument(
        "--summary-csv",
        type=str,
        default="results/benchmark_summary.csv",
        help="File CSV ringkasan speedup & efisiensi (default: results/benchmark_summary.csv)"
    )
    parser.add_argument(
        "--repeats", "-r",
        type=int,
        default=1,
        help="Jumlah repetisi pengujian per konfigurasi (default: 1)"
    )
    return parser.parse_args()


def run_single_benchmark(mpi_cmd, p, n, raw_csv):
    """Menjalankan satu proses MPI dengan parameter P dan N tertentu."""
    python_exec = sys.executable
    script_path = os.path.join(os.path.dirname(__file__), "matrix_mul_mpi.py")

    cmd = [
        mpi_cmd,
        "-n", str(p),
        python_exec, script_path,
        "--size", str(n),
        "--csv", raw_csv,
        "--quiet"
    ]

    print(f"[*] Menjalankan: {' '.join(cmd)}")
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print(f"[!] ERROR pada P={p}, N={n}:")
        print(proc.stderr)
        return False
    else:
        print(f"[+] Selesai P={p}, N={n}.")
        return True


def calculate_metrics(raw_csv, summary_csv):
    """Membaca raw CSV dan menghitung Speedup, Efisiensi, dan ringkasan metrik."""
    if not os.path.exists(raw_csv):
        print(f"[!] File {raw_csv} tidak ditemukan.")
        return

    df = pd.read_csv(raw_csv)
    # Filter matrix size jika ada beberapa
    grouped = df.groupby(["matrix_size", "processes"]).agg({
        "t_total_s": "mean",
        "t_comp_max_s": "mean",
        "t_comm_max_s": "mean",
        "t_comm_in_s": "mean",
        "t_comm_out_s": "mean",
        "comp_percent": "mean",
        "comm_percent": "mean",
        "gflops": "mean"
    }).reset_index()

    # Hitung Speedup & Efisiensi per matrix_size
    summary_rows = []
    for m_size, group in grouped.groupby("matrix_size"):
        group = group.sort_values("processes")
        # Cari baseline P = 1
        baseline_rows = group[group["processes"] == 1]
        if baseline_rows.empty:
            t_seq = group.iloc[0]["t_total_s"]
            base_p = group.iloc[0]["processes"]
            print(f"[!] P=1 tidak ditemukan untuk N={m_size}. Menggunakan P={base_p} sebagai acuan estimasi.")
        else:
            t_seq = baseline_rows.iloc[0]["t_total_s"]

        for _, row in group.iterrows():
            p = int(row["processes"])
            t_par = row["t_total_s"]
            speedup = t_seq / t_par if t_par > 0 else 0
            efficiency = speedup / p if p > 0 else 0

            summary_rows.append({
                "matrix_size": int(m_size),
                "processes": p,
                "t_total_s": t_par,
                "t_comp_s": row["t_comp_max_s"],
                "t_comm_s": row["t_comm_max_s"],
                "t_comm_in_s": row["t_comm_in_s"],
                "t_comm_out_s": row["t_comm_out_s"],
                "comp_percent": row["comp_percent"],
                "comm_percent": row["comm_percent"],
                "speedup": speedup,
                "efficiency": efficiency,
                "throughput_gflops": row["gflops"]
            })

    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(summary_csv, index=False)
    print("\n" + "=" * 90)
    print(" " * 32 + "RINGKASAN BENCHMARK")
    print("=" * 90)
    print(summary_df.to_string(index=False))
    print("=" * 90)
    print(f"[+] Ringkasan berhasil disimpan ke: {summary_csv}")


def main():
    args = parse_arguments()
    mpi_cmd = detect_mpi_command()

    if mpi_cmd is None:
        print("[!] ERROR: 'mpiexec' atau 'mpirun' tidak terdeteksi di PATH sistem.")
        print("    Pastikan Microsoft MPI (Windows) atau OpenMPI (Linux/WSL) telah terinstal.")
        sys.exit(1)

    print(f"[*] MPI Executable terdeteksi: {mpi_cmd}")
    print(f"[*] Variasi Proses: {args.processes}")
    print(f"[*] Dimensi Matriks Strong Scaling: {args.size} x {args.size}")

    # Bersihkan file raw CSV lama jika ada atau biarkan append
    # Untuk uji baru, pastikan folder results ada
    os.makedirs(os.path.dirname(os.path.abspath(args.output_csv)), exist_ok=True)

    # 1. Jalankan Uji Strong Scaling (N tetap, P bertambah)
    print("\n" + "=" * 60)
    print("FASE 1: PENGUJIAN STRONG SCALING (N Tetap)")
    print("=" * 60)
    for p in args.processes:
        for rep in range(args.repeats):
            print(f"--- Running Strong Scaling: P={p}, Repeat={rep + 1}/{args.repeats} ---")
            run_single_benchmark(mpi_cmd, p, args.size, args.output_csv)

    # 2. Jalankan Uji Weak Scaling (jika flag aktif)
    if args.weak_scaling:
        print("\n" + "=" * 60)
        print("FASE 2: PENGUJIAN WEAK SCALING (Beban per Core Konstan)")
        print("=" * 60)
        # N_base untuk P=1, N_weak = int(N_base * sqrt(P))
        base_n = int(args.size / (max(args.processes) ** 0.5))
        for p in args.processes:
            weak_n = int(base_n * (p ** 0.5))
            for rep in range(args.repeats):
                print(f"--- Running Weak Scaling: P={p}, N={weak_n}, Repeat={rep + 1}/{args.repeats} ---")
                run_single_benchmark(mpi_cmd, p, weak_n, args.output_csv)

    # 3. Hitung Speedup & Efisiensi
    calculate_metrics(args.output_csv, args.summary_csv)

    # 4. Trigger plotting script secara otomatis
    plot_script = os.path.join(os.path.dirname(__file__), "plot_results.py")
    if os.path.exists(plot_script):
        print("\n[*] Menjalankan script visualisasi grafik...")
        subprocess.run([sys.executable, plot_script, "--summary-csv", args.summary_csv])


if __name__ == "__main__":
    main()
