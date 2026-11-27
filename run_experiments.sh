#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

MPI_CMD="mpirun"
if command -v mpiexec &> /dev/null; then
    MPI_CMD="mpiexec"
fi

echo "[*] Memeriksa dependensi Python..."
python3 -m pip install -q -r requirements.txt

echo "[1/5] PENGUJIAN LATENCY & BANDWIDTH (PING-PONG BENCHMARK)"
$MPI_CMD -n 2 python3 src/latency_benchmark.py

echo "[2/5] PENGUJIAN HYBRID MPI + OPENMP (4096 x 4096)"
rm -f results/hybrid_mpi_openmp_results.csv
$MPI_CMD -n 4 python3 src/matrix_mul_hybrid.py --size 4096 --threads 1
$MPI_CMD -n 2 python3 src/matrix_mul_hybrid.py --size 4096 --threads 2
$MPI_CMD -n 1 python3 src/matrix_mul_hybrid.py --size 4096 --threads 4
$MPI_CMD -n 2 python3 src/matrix_mul_hybrid.py --size 4096 --threads 4

echo "[3/5] PENGUJIAN STRONG SCALING & WEAK SCALING (P = 1, 2, 4, 8, 16)"
python3 src/benchmark_runner.py --processes 1 2 4 8 16 --size 4096

echo "[4/5] SIMULASI FAULT TOLERANCE (NODE FAILURE & DYNAMIC RESCHEDULING)"
$MPI_CMD -n 4 python3 src/fault_tolerance_sim.py --size 2048 --fail-rank 2

echo "[5/5] GENERATE ULANG VISUALISASI GRAFIK (300 DPI)"
python3 src/plot_results.py

echo "SELURUH EKSPERIMEN SELESAI! Jalankan backend: uvicorn backend.main:app --port 8000"
