#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Script Visualisasi Grafik Performansi & Bottleneck Komunikasi
----------------------------------------------------------------------------------------
Output Grafik (PNG 300 DPI, IEEE Style):
  1. execution_time_vs_cores.png  : Waktu Total, Komputasi, dan Komunikasi vs P
  2. speedup_analysis.png         : Speedup Aktual vs Ideal Linear Speedup
  3. efficiency_analysis.png      : Efisiensi Paralel vs Ideal 100%
  4. communication_bottleneck.png : Breakdown Persentase Komputasi vs Komunikasi
========================================================================================
"""

import sys
import os
import argparse
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Visualisasi Hasil Benchmark HPC Matrix Multiplication"
    )
    parser.add_argument(
        "--summary-csv",
        type=str,
        default="results/benchmark_summary.csv",
        help="Path ke file ringkasan benchmark CSV (default: results/benchmark_summary.csv)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="results",
        help="Direktori penyimpanan grafik (default: results)"
    )
    return parser.parse_args()


def setup_plot_style():
    """Mengatur konfigurasi visual matplotlib bergaya paper ilmiah / IEEE."""
    plt.rcParams.update({
        "font.family": "serif",
        "font.size": 11,
        "axes.labelsize": 12,
        "axes.titlesize": 13,
        "xtick.labelsize": 10,
        "ytick.labelsize": 10,
        "legend.fontsize": 10,
        "figure.titlesize": 14,
        "grid.linestyle": "--",
        "grid.alpha": 0.6,
    })


def plot_execution_time(df, output_dir):
    """Grafik 1: Waktu Eksekusi vs Jumlah Proses (Total, Komputasi, Komunikasi)."""
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)

    p = df["processes"]
    ax.plot(p, df["t_total_s"], marker="o", color="#1f77b4", linewidth=2.2, label=r"Total Execution ($T_{total}$)")
    ax.plot(p, df["t_comp_s"], marker="s", color="#2ca02c", linewidth=2.0, linestyle="--", label=r"Computation ($T_{comp}$)")
    ax.plot(p, df["t_comm_s"], marker="^", color="#d62728", linewidth=2.0, linestyle=":", label=r"Communication ($T_{comm}$)")

    ax.set_xlabel("Number of Processes / Cores ($P$)")
    ax.set_ylabel("Execution Time (seconds)")
    ax.set_title("Execution Time Breakdown vs Processors (Strong Scaling)", pad=12, fontweight="bold")
    ax.set_xticks(p)
    ax.grid(True)
    ax.legend(frameon=True, loc="upper right")

    output_path = os.path.join(output_dir, "execution_time_vs_cores.png")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    print(f"[+] Grafik tersimpan: {output_path}")


def plot_speedup(df, output_dir):
    """Grafik 2: Speedup vs Ideal."""
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)

    p = df["processes"]
    speedup = df["speedup"]

    # Garis ideal linear speedup
    ax.plot(p, p, linestyle="--", color="#7f7f7f", linewidth=1.8, label="Ideal Linear Speedup ($S = P$)")
    ax.plot(p, speedup, marker="o", color="#1f77b4", linewidth=2.2, label="Actual Speedup ($S$)")

    # Annotate nilai aktual
    for x, y in zip(p, speedup):
        ax.annotate(f"{y:.2f}x", xy=(x, y), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9, fontweight="semibold")

    ax.set_xlabel("Number of Processes / Cores ($P$)")
    ax.set_ylabel("Speedup Ratio ($S = T_{seq} / T_{par}$)")
    ax.set_title("Strong Scaling Speedup Curve", pad=12, fontweight="bold")
    ax.set_xticks(p)
    ax.grid(True)
    ax.legend(frameon=True, loc="upper left")

    output_path = os.path.join(output_dir, "speedup_analysis.png")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    print(f"[+] Grafik tersimpan: {output_path}")


def plot_efficiency(df, output_dir):
    """Grafik 3: Efisiensi vs Jumlah Proses."""
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)

    p = df["processes"]
    efficiency = df["efficiency"] * 100  # Dalam persen

    ax.axhline(100, linestyle="--", color="#7f7f7f", linewidth=1.8, label="Ideal Efficiency (100%)")
    ax.plot(p, efficiency, marker="s", color="#2ca02c", linewidth=2.2, label="Actual Efficiency ($E = S / P$)")

    for x, y in zip(p, efficiency):
        ax.annotate(f"{y:.1f}%", xy=(x, y), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9, fontweight="semibold")

    ax.set_xlabel("Number of Processes / Cores ($P$)")
    ax.set_ylabel("Parallel Efficiency (%)")
    ax.set_title("Parallel Efficiency vs Core Count", pad=12, fontweight="bold")
    ax.set_ylim(0, 115)
    ax.set_xticks(p)
    ax.grid(True)
    ax.legend(frameon=True, loc="lower left")

    output_path = os.path.join(output_dir, "efficiency_analysis.png")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    print(f"[+] Grafik tersimpan: {output_path}")


def plot_bottleneck(df, output_dir):
    """Grafik 4: Breakdown Stacked Bar Chart Komputasi vs Komunikasi."""
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)

    p = [str(x) for x in df["processes"]]
    comp_pct = df["comp_percent"]
    comm_pct = df["comm_percent"]

    bar_width = 0.55
    ax.bar(p, comp_pct, width=bar_width, label="Computation Time (%)", color="#2ca02c", alpha=0.85)
    ax.bar(p, comm_pct, width=bar_width, bottom=comp_pct, label="Communication Overhead (%)", color="#d62728", alpha=0.85)

    for i in range(len(p)):
        c_pct = comp_pct.iloc[i]
        m_pct = comm_pct.iloc[i]
        if c_pct > 10:
            ax.text(i, c_pct / 2, f"{c_pct:.1f}%", ha="center", va="center", color="white", fontweight="bold", fontsize=9)
        if m_pct > 10:
            ax.text(i, c_pct + (m_pct / 2), f"{m_pct:.1f}%", ha="center", va="center", color="white", fontweight="bold", fontsize=9)

    ax.set_xlabel("Number of Processes ($P$)")
    ax.set_ylabel("Percentage of Total Execution Time (%)")
    ax.set_title("Communication Bottleneck Analysis (Amdahl's Effect)", pad=12, fontweight="bold")
    ax.set_ylim(0, 105)
    ax.grid(axis="y")
    ax.legend(frameon=True, loc="upper right")

    output_path = os.path.join(output_dir, "communication_bottleneck.png")
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    print(f"[+] Grafik tersimpan: {output_path}")


def main():
    args = parse_arguments()
    if not os.path.exists(args.summary_csv):
        print(f"[!] Error: File summary '{args.summary_csv}' tidak ditemukan.")
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    setup_plot_style()

    df = pd.read_csv(args.summary_csv)
    # Jika terdapat beberapa ukuran matriks, pilih ukuran terbesar (default 4096)
    if "matrix_size" in df.columns:
        max_size = df["matrix_size"].max()
        df = df[df["matrix_size"] == max_size]

    df = df.sort_values("processes").reset_index(drop=True)

    print(f"[*] Membuat grafik visualisasi dari data {len(df)} titik proses...")
    plot_execution_time(df, args.output_dir)
    plot_speedup(df, args.output_dir)
    plot_efficiency(df, args.output_dir)
    plot_bottleneck(df, args.output_dir)
    print("[+] Seluruh visualisasi berhasil di-generate di folder:", args.output_dir)


if __name__ == "__main__":
    main()
