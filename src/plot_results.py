#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Script Visualisasi Grafik Performansi & Bottleneck Komunikasi (300 DPI, IEEE Style)
========================================================================================
"""

import argparse
import os
import sys
import pandas as pd
import matplotlib.pyplot as plt


def parse_arguments():
    parser = argparse.ArgumentParser(description="Visualisasi Hasil Benchmark HPC Matrix Multiplication")
    parser.add_argument("--summary-csv", type=str, default="results/benchmark_summary.csv")
    parser.add_argument("--weak-csv", type=str, default="results/weak_scaling_summary.csv")
    parser.add_argument("--output-dir", type=str, default="results")
    return parser.parse_args()


def setup_plot_style():
    plt.rcParams.update({
        "font.family": "serif",
        "font.size": 11,
        "axes.labelsize": 12,
        "axes.titlesize": 13,
        "xtick.labelsize": 10,
        "ytick.labelsize": 10,
        "legend.fontsize": 10,
        "grid.linestyle": "--",
        "grid.alpha": 0.55,
    })


def plot_execution_time(df, output_dir):
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)
    p = df["processes"]
    ax.plot(p, df["t_total_s"], marker="o", color="#0EA5E9", linewidth=2.2, label=r"Total Execution ($T_{total}$)")
    ax.plot(p, df["t_comp_s"], marker="s", color="#10B981", linewidth=2.0, linestyle="--", label=r"Computation ($T_{comp}$)")
    ax.plot(p, df["t_comm_s"], marker="^", color="#F59E0B", linewidth=2.0, linestyle=":", label=r"Communication ($T_{comm}$)")
    ax.set_xlabel("Number of Processes ($P$)")
    ax.set_ylabel("Execution Time (seconds)")
    ax.set_title(f"Execution Time Breakdown vs Processors (Strong Scaling {int(df['matrix_size'].iloc[0])}×{int(df['matrix_size'].iloc[0])})", pad=12, fontweight="bold")
    ax.set_xticks(p)
    ax.grid(True)
    ax.legend(frameon=True, loc="upper left")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "execution_time_vs_cores.png"))
    plt.close()


def plot_speedup(df, output_dir):
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)
    p = df["processes"]
    speedup = df["speedup"]
    ax.plot(p, p, linestyle="--", color="#71717A", linewidth=1.8, label="Ideal Linear Speedup ($S = P$)")
    ax.plot(p, speedup, marker="o", color="#0EA5E9", linewidth=2.2, label="Actual Speedup ($S$)")
    for x, y in zip(p, speedup):
        ax.annotate(f"{y:.2f}x", xy=(x, y), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9, fontweight="semibold")
    ax.set_xlabel("Number of Processes ($P$)")
    ax.set_ylabel("Speedup Ratio ($S = T_{seq} / T_{par}$)")
    ax.set_title("Strong Scaling Speedup Curve (Amdahl's Law)", pad=12, fontweight="bold")
    ax.set_xticks(p)
    ax.grid(True)
    ax.legend(frameon=True, loc="upper left")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "speedup_analysis.png"))
    plt.close()


def plot_efficiency(df, output_dir):
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)
    p = df["processes"]
    efficiency = df["efficiency"] * 100
    ax.axhline(100, linestyle="--", color="#71717A", linewidth=1.8, label="Ideal Efficiency (100%)")
    ax.plot(p, efficiency, marker="s", color="#10B981", linewidth=2.2, label="Actual Efficiency ($E = S / P$)")
    for x, y in zip(p, efficiency):
        ax.annotate(f"{y:.1f}%", xy=(x, y), xytext=(0, 7), textcoords="offset points", ha="center", fontsize=9, fontweight="semibold")
    ax.set_xlabel("Number of Processes ($P$)")
    ax.set_ylabel("Parallel Efficiency (%)")
    ax.set_title("Parallel Efficiency vs Core Count", pad=12, fontweight="bold")
    ax.set_ylim(0, 115)
    ax.set_xticks(p)
    ax.grid(True)
    ax.legend(frameon=True, loc="upper right")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "efficiency_analysis.png"))
    plt.close()


def plot_bottleneck(df, output_dir):
    fig, ax = plt.subplots(figsize=(8, 5), dpi=300)
    p = [str(x) for x in df["processes"]]
    comp_pct = df["comp_percent"]
    comm_pct = df["comm_percent"]
    ax.bar(p, comp_pct, width=0.55, label="Computation Time (%)", color="#10B981", alpha=0.88)
    ax.bar(p, comm_pct, width=0.55, bottom=comp_pct, label="Communication Overhead (%)", color="#F59E0B", alpha=0.88)
    for i in range(len(p)):
        c_pct, m_pct = comp_pct.iloc[i], comm_pct.iloc[i]
        if c_pct > 10:
            ax.text(i, c_pct / 2, f"{c_pct:.1f}%", ha="center", va="center", color="white", fontweight="bold", fontsize=9)
        if m_pct > 10:
            ax.text(i, c_pct + m_pct / 2, f"{m_pct:.1f}%", ha="center", va="center", color="white", fontweight="bold", fontsize=9)
    ax.set_xlabel("Number of Processes ($P$)")
    ax.set_ylabel("Percentage of Total Execution Time (%)")
    ax.set_title("Communication Bottleneck Analysis", pad=12, fontweight="bold")
    ax.set_ylim(0, 105)
    ax.grid(axis="y")
    ax.legend(frameon=True, loc="upper right")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "communication_bottleneck.png"))
    plt.close()


def plot_weak_scaling(weak_csv, output_dir):
    if not os.path.exists(weak_csv):
        return
    df = pd.read_csv(weak_csv)
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5), dpi=300)
    p = df["processes"]
    labels = [f"P={int(r.processes)}\nN={int(r.matrix_size)}" for _, r in df.iterrows()]

    ax1.plot(range(len(p)), df["t_total_s"], marker="o", color="#0EA5E9", linewidth=2.0, label="Actual Execution Time")
    ax1.axhline(df.iloc[0]["t_total_s"], linestyle="--", color="#71717A", linewidth=1.5, label="Ideal Constant Time")
    ax1.set_xticks(range(len(p)))
    ax1.set_xticklabels(labels, fontsize=9)
    ax1.set_xlabel("Processes and Scaled Matrix Size (N)")
    ax1.set_ylabel("Execution Time (seconds)")
    ax1.set_title("Weak Scaling Execution Time (Gustafson's Law)", pad=10, fontweight="bold")
    ax1.grid(True)
    ax1.legend(frameon=True)

    ax2.plot(p, p, linestyle="--", color="#71717A", linewidth=1.8, label="Ideal Scaled Speedup ($S = P$)")
    ax2.plot(p, df["gustafson_speedup"], marker="s", color="#10B981", linewidth=2.0, label="Scaled Speedup ($S_{weak}$)")
    for x, y in zip(p, df["gustafson_speedup"]):
        ax2.annotate(f"{y:.2f}x", xy=(x, y), xytext=(0, 6), textcoords="offset points", ha="center", fontsize=9, fontweight="semibold")
    ax2.set_xticks(p)
    ax2.set_xlabel("Number of Processes ($P$)")
    ax2.set_ylabel("Scaled Speedup")
    ax2.set_title("Weak Scaling Scaled Speedup", pad=10, fontweight="bold")
    ax2.grid(True)
    ax2.legend(frameon=True, loc="upper left")

    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "weak_scaling_analysis.png"))
    plt.close()


def main():
    args = parse_arguments()
    if not os.path.exists(args.summary_csv):
        print(f"[!] Error: File summary '{args.summary_csv}' tidak ditemukan.")
        sys.exit(1)
    os.makedirs(args.output_dir, exist_ok=True)
    setup_plot_style()
    df = pd.read_csv(args.summary_csv)
    if "matrix_size" in df.columns:
        df = df[df["matrix_size"] == df["matrix_size"].max()]
    df = df.sort_values("processes").reset_index(drop=True)
    plot_execution_time(df, args.output_dir)
    plot_speedup(df, args.output_dir)
    plot_efficiency(df, args.output_dir)
    plot_bottleneck(df, args.output_dir)
    plot_weak_scaling(args.weak_csv, args.output_dir)
    print(f"[+] Seluruh grafik berhasil di-generate di folder: {args.output_dir}")


if __name__ == "__main__":
    main()
