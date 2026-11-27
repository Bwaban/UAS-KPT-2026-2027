# MPI Matrix Lab — Perkalian Matriks 4096 × 4096 Terdistribusi (MPI4Py + OpenMP)

> **Tugas Besar Ujian Akhir Semester (UAS) Ganjil T.A. 2026/2027**  
> **Mata Kuliah:** Komputasi Paralel dan Terdistribusi (3 SKS)  
> **Program Studi:** Informatika, Fakultas Teknik, Universitas Siliwangi  
> **Dosen Pengampu:** Ir. Randi Rizal, Ph.D.  
> **Tema:** Tema 3 — *High-Performance Computing (HPC) for Matrix Computation*

---

## Ringkasan Proyek

Repositori ini mengimplementasikan sistem **High-Performance Computing (HPC)** untuk perkalian matriks kuadrat berukuran **$4096 \times 4096$** (`float32`, ~64 MB/matriks, $2N^3 \approx 137.44$ GFLOPs) menggunakan **MPI (`mpi4py`)** dan **OpenMP**, lengkap dengan:

1. **Pure MPI 1D Block-Row Decomposition** (`src/matrix_mul_mpi.py`): distribusi `MPI_Bcast`, `MPI_Scatterv`, komputasi lokal, dan `MPI_Gatherv`.
2. **Hybrid MPI + OpenMP** (`src/matrix_mul_hybrid.py`): perbandingan *Pure MPI* vs *Hybrid Distributed + Shared Memory*.
3. **Strong Scaling & Weak Scaling ($P \in \{1, 2, 4, 8, 16\}$)** (`src/benchmark_runner.py` & `src/plot_results.py`): pembuktian Hukum Amdahl, Hukum Gustafson, dan *Communication Bottleneck*.
4. **Ping-Pong Latency & Bandwidth Benchmark** (`src/latency_benchmark.py`): pengukuran *One-Way Latency* (µs/ms) dan *Effective Bandwidth* (MB/s) dari `4 B` hingga `64 MB`.
5. **Fault Tolerance & Dynamic Task Rescheduling** (`src/fault_tolerance_sim.py`): simulasi 1 worker node crash dengan pemulihan tugas otomatis dan validasi integritas matriks 100%.
6. **Live Monitoring & Control Dashboard (React + FastAPI)** (`backend/main.py` + `src/`): dashboard web interaktif dengan telemetri CPU/RAM real-time (`psutil`), WebSocket log streaming, dan eksekusi MPI langsung.
7. **Docker Multi-Node Cluster & Shared Volume** (`Dockerfile` & `docker-compose.yml`): topologi `master-node`, `worker-node-1`, `worker-node-2`, `frontend-ui`, dan volume terdistribusi `/shared_data`.

---

## Struktur Arsitektur Sistem

```
                  +-------------------------------------------+
                  |      MASTER NODE (Rank 0) + FastAPI       |
                  | - Task Scheduler & Fault Detector         |
                  | - MPI_Bcast(B) & MPI_Scatterv(A)          |
                  | - REST API + WebSocket /ws/log + psutil   |
                  +---------------------+---------------------+
                                        | (MPI Channel)
              +-------------------------+-------------------------+
              v                                                   v
+---------------------------+                       +---------------------------+
|    WORKER NODE 1 (Rank 1) |                       |   WORKER NODE (P-1)       |
| - local_A (rows × N)      |                       | - local_A (rows × N)      |
| - Matrix B cache          |                       | - Matrix B cache          |
| - OpenMP / BLAS matmul    |                       | - OpenMP / BLAS matmul    |
+-------------+-------------+                       +-------------+-------------+
              +-------------------------+-------------------------+
                                        | (MPI_Gatherv C + /shared_data)
                                        v
                  +-------------------------------------------+
                  |  SHARED VOLUME (/shared_data) + REACT UI  |
                  | - Docker Volume: hpc-shared-storage       |
                  | - Dashboard Web (Vite + Recharts + KaTeX) |
                  +-------------------------------------------+
```

---

## Struktur Direktori

```text
├── backend/
│   └── main.py                  # Server FastAPI (REST + WebSocket log + psutil telemetry)
├── src/
│   ├── matrix_mul_mpi.py        # Perkalian matriks 4096×4096 Pure MPI (Scatterv/Bcast/Gatherv)
│   ├── matrix_mul_hybrid.py     # Perkalian matriks Hybrid MPI + OpenMP multithreading
│   ├── benchmark_runner.py      # Otomasi Strong Scaling & Weak Scaling (P = 1, 2, 4, 8, 16)
│   ├── latency_benchmark.py     # Uji Ping-Pong Latency & Effective Bandwidth antar-node
│   ├── fault_tolerance_sim.py   # Simulasi 1 node gagal + Dynamic Task Rescheduling
│   ├── plot_results.py          # Generator grafik performa 300 DPI (IEEE Style)
│   ├── components/              # Komponen UI Dashboard React
│   ├── pages/                   # Halaman Dashboard, Eksperimen, Benchmark, Fault, Arsitektur
│   ├── data/mock.ts             # Snapshot hasil benchmark aktual untuk mode offline
│   └── lib/                     # Klien API (api.ts) & utilitas format (utils.ts)
├── results/                     # Output CSV, log fault tolerance, dan grafik PNG 300 DPI
├── Dockerfile                   # Image klaster OpenMPI + Python + FastAPI
├── docker-compose.yml           # Klaster multi-container + shared volume + React UI
├── run_experiments.bat          # Skrip eksekusi 1-klik (Windows MS-MPI)
├── run_experiments.sh           # Skrip eksekusi 1-klik (Linux / WSL / OpenMPI)
└── requirements.txt             # Dependensi Python
```

---

## Persyaratan & Instalasi

* **Python 3.10+** + **MPI Driver** ([Microsoft MPI](https://www.microsoft.com/en-us/download/details.aspx?id=105289) di Windows atau `sudo apt install libopenmpi-dev openmpi-bin` di Linux/WSL).
* **Node.js 18+** untuk dashboard React.

```bash
pip install -r requirements.txt
npm install
```

---

## Panduan Eksekusi

### 1. Menjalankan Seluruh Eksperimen UAS (1-Klik)
* **Windows:** `.\run_experiments.bat`
* **Linux / WSL:** `bash run_experiments.sh`

### 2. Menjalankan Modul Secara Mandiri
```bash
# Uji tunggal 4096×4096 + validasi numerik
mpiexec -n 4 python src/matrix_mul_mpi.py --size 4096 --verify

# Uji Latency & Bandwidth (Ping-Pong)
mpiexec -n 2 python src/latency_benchmark.py

# Uji Hybrid MPI + OpenMP (2 proses MPI × 4 thread OpenMP)
mpiexec -n 2 python src/matrix_mul_hybrid.py --size 4096 --threads 4

# Uji Strong Scaling & Weak Scaling lengkap (P = 1, 2, 4, 8, 16)
python src/benchmark_runner.py --processes 1 2 4 8 16 --size 4096

# Simulasi Fault Tolerance (Worker Rank 2 crash)
mpiexec -n 4 python src/fault_tolerance_sim.py --size 2048 --fail-rank 2
```

### 3. Menjalankan Dashboard Monitoring Live (React + FastAPI)
Buka 2 terminal:
```bash
# Terminal 1 — Backend FastAPI (eksekusi MPI langsung + telemetri CPU/RAM + WebSocket)
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend React
npm run dev
```
Buka `http://localhost:5173`. Frontend mendeteksi backend FastAPI secara otomatis (`VITE_USE_MOCK=auto`) dan akan menampilkan indikator **Live API** beserta CPU/RAM real-time di sidebar.

### 4. Deployment dengan Docker Compose (Shared Volume)
```bash
docker compose up --build -d
```
Akses Frontend di `http://localhost:5173` dan API Docs di `http://localhost:8000/docs`.
