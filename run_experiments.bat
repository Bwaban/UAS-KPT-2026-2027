@echo off
setlocal
cd /d "%~dp0"

echo ===============================================================================
echo   HPC DISTRIBUTED MATRIX COMPUTATION (4096 x 4096) - FULL UAS SUITE
echo   Mata Kuliah: Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
echo ===============================================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan di PATH sistem.
    pause
    exit /b 1
)

where mpiexec >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Microsoft MPI mpiexec tidak ditemukan di PATH sistem.
    pause
    exit /b 1
)

echo [*] Memeriksa dependensi Python...
python -m pip install -q -r requirements.txt

echo.
echo [1/5] PENGUJIAN LATENCY & BANDWIDTH (PING-PONG BENCHMARK)
mpiexec -n 2 python src/latency_benchmark.py

echo.
echo [2/5] PENGUJIAN HYBRID MPI + OPENMP (4096 x 4096)
if exist results\hybrid_mpi_openmp_results.csv del results\hybrid_mpi_openmp_results.csv
mpiexec -n 4 python src/matrix_mul_hybrid.py --size 4096 --threads 1
mpiexec -n 2 python src/matrix_mul_hybrid.py --size 4096 --threads 2
mpiexec -n 1 python src/matrix_mul_hybrid.py --size 4096 --threads 4
mpiexec -n 2 python src/matrix_mul_hybrid.py --size 4096 --threads 4

echo.
echo [3/5] PENGUJIAN STRONG SCALING & WEAK SCALING (P = 1, 2, 4, 8, 16)
python src/benchmark_runner.py --processes 1 2 4 8 16 --size 4096

echo.
echo [4/5] SIMULASI FAULT TOLERANCE (NODE FAILURE & DYNAMIC RESCHEDULING)
mpiexec -n 4 python src/fault_tolerance_sim.py --size 2048 --fail-rank 2

echo.
echo [5/5] GENERATE ULANG VISUALISASI GRAFIK (300 DPI)
python src/plot_results.py

echo.
echo ===============================================================================
echo SELURUH EKSPERIMEN SELESAI! Hasil tersimpan di folder: results/
echo Untuk menjalankan Dashboard Live:
echo   1. Backend : uvicorn backend.main:app --reload --port 8000
echo   2. Frontend: npm run dev
echo ===============================================================================
pause
