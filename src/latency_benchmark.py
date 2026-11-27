#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Pengujian Latency dan Bandwidth Komunikasi Antar-Node MPI (Ping-Pong Benchmark)
----------------------------------------------------------------------------------------
Sesuai Parameter Soal F.4: "Latency: Waktu rata-rata komunikasi antar node."
========================================================================================
"""

import argparse
import os
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from mpi4py import MPI


def parse_arguments():
    parser = argparse.ArgumentParser(description="MPI Ping-Pong Benchmark for Node Latency and Bandwidth")
    parser.add_argument("--output-csv", type=str, default="results/latency_results.csv")
    parser.add_argument("--output-plot", type=str, default="results/latency_bandwidth_curve.png")
    parser.add_argument("--trials", type=int, default=20)
    return parser.parse_args()


def main():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()

    if size < 2:
        if rank == 0:
            print("[!] ERROR: Latency Ping-Pong membutuhkan minimal 2 proses MPI (mpiexec -n 2 ...)")
        sys.exit(1)

    args = parse_arguments()
    message_sizes_bytes = [
        4, 16, 64, 256, 1024, 4096, 16384, 65536,
        262144, 1048576, 4194304, 16777216, 67108864,
    ]
    results = []

    if rank == 0:
        print("=" * 80)
        print(" " * 20 + "MPI PING-PONG LATENCY & BANDWIDTH BENCHMARK")
        print("=" * 80)
        print(f"{'Ukuran Pesan':<16} | {'One-Way Latency (ms)':<22} | {'Bandwidth (MB/s)':<18}")
        print("-" * 80)

    warm_buf = np.zeros(1024, dtype=np.uint8)
    for _ in range(5):
        if rank == 0:
            comm.Send(warm_buf, dest=1, tag=999)
            comm.Recv(warm_buf, source=1, tag=999)
        elif rank == 1:
            comm.Recv(warm_buf, source=0, tag=999)
            comm.Send(warm_buf, dest=0, tag=999)

    for nbytes in message_sizes_bytes:
        buf = np.ones(nbytes, dtype=np.uint8)
        recv_buf = np.empty(nbytes, dtype=np.uint8)
        comm.Barrier()

        if rank == 0:
            t_start = MPI.Wtime()
            for _ in range(args.trials):
                comm.Send(buf, dest=1, tag=100)
                comm.Recv(recv_buf, source=1, tag=101)
            t_total = MPI.Wtime() - t_start

            latency_sec = (t_total / args.trials) / 2.0
            latency_ms = latency_sec * 1000.0
            latency_us = latency_sec * 1e6
            bandwidth_mbps = (nbytes / (1024.0 * 1024.0)) / latency_sec if latency_sec > 0 else 0.0

            if nbytes < 1024:
                size_str = f"{nbytes} B"
            elif nbytes < 1048576:
                size_str = f"{nbytes // 1024} KB"
            else:
                size_str = f"{nbytes // 1048576} MB"

            print(f"{size_str:<16} | {latency_ms:<22.4f} | {bandwidth_mbps:<18.2f}")
            results.append({
                "bytes": nbytes,
                "size_label": size_str,
                "latency_us": latency_us,
                "latency_ms": latency_ms,
                "bandwidth_mbps": bandwidth_mbps,
            })
        elif rank == 1:
            for _ in range(args.trials):
                comm.Recv(recv_buf, source=0, tag=100)
                comm.Send(recv_buf, dest=0, tag=101)

    if rank == 0:
        print("=" * 80)
        os.makedirs(os.path.dirname(os.path.abspath(args.output_csv)), exist_ok=True)
        df = pd.DataFrame(results)
        df.to_csv(args.output_csv, index=False)
        print(f"[+] Rekapitulasi latency tersimpan di: {args.output_csv}")

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4.8), dpi=300)
        ax1.plot(df["bytes"], df["latency_ms"], marker="o", color="#F59E0B", linewidth=2.0)
        ax1.set_xscale("log")
        ax1.set_yscale("log")
        ax1.set_xlabel("Message Size (Bytes)")
        ax1.set_ylabel("One-Way Latency (ms) [Log Scale]")
        ax1.set_title("Communication Latency vs Message Size", fontsize=11, fontweight="bold")
        ax1.grid(True, which="both", linestyle="--", alpha=0.5)

        ax2.plot(df["bytes"], df["bandwidth_mbps"], marker="s", color="#0EA5E9", linewidth=2.0)
        ax2.set_xscale("log")
        ax2.set_xlabel("Message Size (Bytes)")
        ax2.set_ylabel("Effective Bandwidth (MB/s)")
        ax2.set_title("Effective Inter-Node Bandwidth", fontsize=11, fontweight="bold")
        ax2.grid(True, which="both", linestyle="--", alpha=0.5)

        plt.tight_layout()
        os.makedirs(os.path.dirname(os.path.abspath(args.output_plot)), exist_ok=True)
        plt.savefig(args.output_plot)
        plt.close()
        print(f"[+] Grafik Latency & Bandwidth tersimpan di: {args.output_plot}")


if __name__ == "__main__":
    main()
