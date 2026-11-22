@echo off
REM ========================================================================================
REM Script Otomasi Eksperimen HPC Perkalian Matriks 4096 x 4096 (Windows)
REM UAS Komputasi Paralel dan Terdistribusi 2026/2027 - Universitas Siliwangi
REM ========================================================================================

echo ===============================================================================
echo   MEMULAI EKSPERIMEN PERKALIAN MATRIKS TERDISTRIBUSI MPI4PY (WINDOWS MS-MPI)
echo ===============================================================================
echo.

REM 1. Cek apakah Python dan mpiexec tersedia
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python tidak ditemukan di PATH. Silakan install Python 3.8+.
    pause
    exit /b 1
)

where mpiexec >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] mpiexec (MS-MPI) tidak ditemukan di PATH.
    echo Pastikan Microsoft MPI v10+ sudah terinstal dari situs resmi Microsoft.
    pause
    exit /b 1
)

REM 2. Install dependensi jika belum
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
echo [3/3] MENJALANKAN SIMULASI FAULT TOLERANCE (NODE FAILURE RECOVERY)
echo ===============================================================================
mpiexec -n 4 python src/fault_tolerance_sim.py --size 2048 --fail-rank 2

echo.
echo ===============================================================================
echo SELURUH EKSPERIMEN SELESAI!
echo Hasil CSV & Grafik tersimpan di folder: results/
echo ===============================================================================
pause
