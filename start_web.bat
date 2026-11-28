@echo off
setlocal
cd /d "%~dp0"

echo ===============================================================================
echo   MPI MATRIX LAB — LAUNCHER WEB TERPADU (FastAPI + React UI)
echo   Akses langsung di: http://127.0.0.1:8000
echo ===============================================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python tidak ditemukan di PATH sistem.
    pause
    exit /b 1
)

if not exist dist\index.html (
    echo [*] Membangun frontend React pertama kali...
    call npm run build
)

echo [*] Menjalankan server terpadu di http://127.0.0.1:8000 ...
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://127.0.0.1:8000"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
pause
