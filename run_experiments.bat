@echo off
setlocal
cd /d "%~dp0"

echo ===============================================================================
echo   MEMULAI EKSPERIMEN PERKALIAN MATRIKS TERDISTRIBUSI MPI4PY - WINDOWS MS-MPI
echo ===============================================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan di PATH sistem.
    echo Silakan install Python 3.8+ atau tambahkan ke PATH.
    pause
    exit /b 1
)

where mpiexec >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Microsoft MPI mpiexec tidak ditemukan di PATH sistem.
    echo Pastikan Microsoft MPI sudah terinstal di Program Files Microsoft MPI Bin
    pause
    exit /b 1
)

echo [*] Python dan MS-MPI terdeteksi dengan sukses!
echo [*] Memeriksa dependensi Python...
python -m pip install -r requirements.txt

echo.
echo ===============================================================================
echo [1/3] MENJALANKAN UJI TUNGGAL (4 PROSES, MATRIKS 4096 x 4096)
echo ===============================================================================
mpiexec -n 4 python src/matrix_mul_mpi.py --size 4096 --csv results/benchmark_results.csv --verify

echo.
echo ===============================================================================
echo [2/3] MENJALANKAN BENCHMARK LENGKAP STRONG SCALING (P = 1, 2, 4, 8)
echo ===============================================================================
python src/benchmark_runner.py --processes 1 2 4 8 --size 4096

echo.
echo ===============================================================================
echo [3/3] MENJALANKAN SIMULASI FAULT TOLERANCE - NODE FAILURE RECOVERY
echo ===============================================================================
mpiexec -n 4 python src/fault_tolerance_sim.py --size 2048 --fail-rank 2

echo.
echo ===============================================================================
echo SELURUH EKSPERIMEN SELESAI!
echo Hasil CSV dan Grafik PNG tersimpan di folder: results/
echo ===============================================================================
pause
