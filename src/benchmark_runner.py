#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Script Otomasi Pengujian Benchmark & Scaling (Strong & Weak Scaling)
========================================================================================
"""

import argparse
import os
import shutil
import subprocess
import sys
import pandas as pd


def detect_mpi_command():
    for cmd in ["mpiexec", "mpirun"]:
        if shutil.which(cmd) is not None:
            return cmd
    return None


def parse_arguments():
    parser = argparse.ArgumentParser(description="Otomasi Pengujian Benchmark MPI4Py (Strong & Weak Scaling)")
    parser.add_argument("--processes", "-p", nargs="+", type=int, default=[1, 2, 4, 8, 16])
    parser.add_argument("--size", "-n", type=int, default=4096)
    parser.add_argument("--no-weak-scaling", action="store_true", help="Lewati pengujian Weak Scaling")
    parser.add_argument("--output-csv", type=str, default="results/benchmark_results.csv")
    parser.add_argument("--summary-csv", type=str, default="results/benchmark_summary.csv")
    parser.add_argument("--weak-csv", type=str, default="results/weak_scaling_summary.csv")
    parser.add_argument("--repeats", "-r", type=int, default=1)
    return parser.parse_args()


def run_single_benchmark(mpi_cmd, p, n, raw_csv):
    python_exec = sys.executable
    script_path = os.path.join(os.path.dirname(__file__), "matrix_mul_mpi.py")
    cmd = [mpi_cmd]
    if sys.platform != "win32":
        cmd.append("--oversubscribe")
    cmd.extend(["-n", str(p), python_exec, script_path, "--size", str(n), "--csv", raw_csv, "--quiet"])
    print(f"[*] Menjalankan: {' '.join(cmd)}", flush=True)
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print(f"[!] ERROR pada P={p}, N={n}:\n{proc.stderr}", flush=True)
        return False
    print(f"[+] Selesai P={p}, N={n}.", flush=True)
    return True


def calculate_strong_scaling_metrics(raw_csv, summary_csv, target_size=4096):
    if not os.path.exists(raw_csv):
        return
    df = pd.read_csv(raw_csv)
    df_filtered = df[df["matrix_size"] == target_size]
    if df_filtered.empty:
        return

    grouped = (
        df_filtered.groupby("processes")
        .agg({
            "t_total_s": "mean",
            "t_comp_max_s": "mean",
            "t_comm_max_s": "mean",
            "t_comm_in_s": "mean",
            "t_comm_out_s": "mean",
            "comp_percent": "mean",
            "comm_percent": "mean",
            "gflops": "mean",
        })
        .reset_index()
        .sort_values("processes")
    )

    baseline = grouped[grouped["processes"] == 1]
    t_seq = baseline.iloc[0]["t_total_s"] if not baseline.empty else grouped.iloc[0]["t_total_s"]

    summary_rows = []
    for _, row in grouped.iterrows():
        p = int(row["processes"])
        t_par = row["t_total_s"]
        speedup = t_seq / t_par if t_par > 0 else 0.0
        efficiency = speedup / p if p > 0 else 0.0
        summary_rows.append({
            "matrix_size": target_size,
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
            "throughput_gflops": row["gflops"],
        })

    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(summary_csv, index=False)
    print("\n" + "=" * 90)
    print(f"                            RINGKASAN STRONG SCALING (N={target_size})")
    print("=" * 90)
    print(summary_df.to_string(index=False))
    print("=" * 90, flush=True)


def calculate_weak_scaling_metrics(weak_results, weak_csv):
    weak_df = pd.DataFrame(weak_results)
    if weak_df.empty:
        return
    base_time = weak_df.iloc[0]["t_total_s"]
    base_work = 2.0 * (weak_df.iloc[0]["matrix_size"] ** 3)
    scaled_speedups, scaled_effs = [], []
    for _, row in weak_df.iterrows():
        p = row["processes"]
        t_p = row["t_total_s"]
        work_p = 2.0 * (row["matrix_size"] ** 3)
        speedup = (work_p / base_work) / (t_p / base_time) if t_p > 0 else 0.0
        scaled_speedups.append(speedup)
        scaled_effs.append(speedup / p if p > 0 else 0.0)
    weak_df["gustafson_speedup"] = scaled_speedups
    weak_df["weak_efficiency"] = scaled_effs
    weak_df.to_csv(weak_csv, index=False)
    print("\n" + "=" * 90)
    print("                                RINGKASAN WEAK SCALING")
    print("=" * 90)
    print(weak_df.to_string(index=False))
    print("=" * 90, flush=True)


def main():
    args = parse_arguments()
    mpi_cmd = detect_mpi_command()
    if mpi_cmd is None:
        print("[!] ERROR: 'mpiexec' atau 'mpirun' tidak terdeteksi di PATH sistem.")
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(args.output_csv)), exist_ok=True)
    if os.path.exists(args.output_csv):
        os.remove(args.output_csv)

    print(f"[*] FASE 1: STRONG SCALING (N={args.size}, P={args.processes})", flush=True)
    for p in args.processes:
        for _ in range(args.repeats):
            run_single_benchmark(mpi_cmd, p, args.size, args.output_csv)

    calculate_strong_scaling_metrics(args.output_csv, args.summary_csv, target_size=args.size)

    if not args.no_weak_scaling:
        print("\n[*] FASE 2: WEAK SCALING (Beban FLOPs per Node Konstan)", flush=True)
        base_n = 2048
        weak_results = []
        for p in args.processes:
            weak_n = max(16, (int(base_n * (p ** (1.0 / 3.0))) // 16) * 16)
            temp_csv = f"results/temp_weak_p{p}.csv"
            if os.path.exists(temp_csv):
                os.remove(temp_csv)
            if run_single_benchmark(mpi_cmd, p, weak_n, temp_csv) and os.path.exists(temp_csv):
                tdf = pd.read_csv(temp_csv)
                if not tdf.empty:
                    r = tdf.iloc[-1]
                    weak_results.append({
                        "processes": p,
                        "matrix_size": weak_n,
                        "t_total_s": r["t_total_s"],
                        "t_comp_s": r["t_comp_max_s"],
                        "t_comm_s": r["t_comm_max_s"],
                        "comp_percent": r["comp_percent"],
                        "comm_percent": r["comm_percent"],
                        "throughput_gflops": r["gflops"],
                    })
                os.remove(temp_csv)
        calculate_weak_scaling_metrics(weak_results, args.weak_csv)

    plot_script = os.path.join(os.path.dirname(__file__), "plot_results.py")
    if os.path.exists(plot_script):
        subprocess.run([sys.executable, plot_script, "--summary-csv", args.summary_csv, "--weak-csv", args.weak_csv])


if __name__ == "__main__":
    main()
