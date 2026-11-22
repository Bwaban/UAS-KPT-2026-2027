#!/usr/bin/env bash
# ========================================================================================
# Script Otomasi Eksperimen HPC Perkalian Matriks 4096 x 4096 (Linux / OpenMPI / WSL)
# UAS Komputasi Paralel dan Terdistribusi 2026/2027 - Universitas Siliwangi
# ========================================================================================

set -e

echo "==============================================================================="
echo "  MEMULAI EKSPERIMEN PERKALIAN MATRIKS TERDISTRIBUSI MPI4PY (LINUX / OPENMPI)"
echo "==============================================================================="

# Deteksi mpirun atau mpiexec
MPI_CMD=""
if command -v mpirun &> /dev/null; then
    MPI_CMD="mpirun --oversubscribe"
elif command -v mpiexec &> /dev/null; then
    MPI_CMD="mpiexec --oversubscribe"
else
    echo "[ERROR] mpirun / mpiexec tidak ditemukan! Silakan install: sudo apt install libopenmpi-dev openmpi-bin"
    exit 1
fi

echo "[*] MPI Command: $MPI_CMD"

# Install dependensi jika perlu
pip install -r requirements.txt

echo ""
echo "==============================================================================="
echo "[1/3] MENJALANKAN UJI TUNGGAL (4 PROSES, MATRIKS 4096 x 4096)"
echo "==============================================================================="
$MPI_CMD -n 4 python3 src/matrix_mul_mpi.py --size 4096 --csv results/benchmark_results.csv --verify

echo ""
echo "==============================================================================="
echo "[2/3] MENJALANKAN BENCHMARK LENGKAP STRONG SCALING (P = 1, 2, 4, 8, 16)"
echo "==============================================================================="
python3 src/benchmark_runner.py --processes 1 2 4 8 16 --size 4096

echo ""
echo "==============================================================================="
echo "[3/3] MENJALANKAN SIMULASI FAULT TOLERANCE (NODE FAILURE RECOVERY)"
echo "==============================================================================="
$MPI_CMD -n 4 python3 src/fault_tolerance_sim.py --size 2048 --fail-rank 2

echo ""
echo "==============================================================================="
echo "SELURUH EKSPERIMEN SELESAI! Hasil CSV & Grafik tersimpan di: results/"
echo "==============================================================================="
