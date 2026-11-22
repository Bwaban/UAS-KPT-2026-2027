# Analisis Waktu Komputasi dan Overhead Komunikasi pada Perkalian Matriks 4096 × 4096 Terdistribusi Menggunakan MPI4Py

> **Tugas Besar Ujian Akhir Semester (UAS) Ganjil T.A. 2026/2027**  
> **Mata Kuliah:** Komputasi Paralel dan Terdistribusi (3 SKS)  
> **Program Studi:** Informatika, Fakultas Teknik, Universitas Siliwangi  
> **Dosen Pengampu:** Ir. Randi Rizal, Ph.D.  
> **Tema:** Tema 3 — *High-Performance Computing (HPC) for Matrix Computation*

---

## 📌 Ringkasan Proyek

Repositori ini berisi implementasi sistem komputasi terdistribusi berkinerja tinggi (*High-Performance Computing*) untuk perkalian matriks kuadrat berukuran masif ($4096 \times 4096$) menggunakan protokol **Message Passing Interface (MPI)** melalui pustaka **MPI4Py** dan **NumPy (BLAS-accelerated)**. 

Fokus utama proyek ini adalah:
1. **Dekomposisi Data 1D Row-wise (Block Row Decomposition):** Membagi matriks baris per baris secara proporsional antar worker menggunakan kolektif komunikasi `Scatterv`, `Bcast`, dan `Gatherv`.
2. **Isolasi dan Analisis Bottleneck Komunikasi:** Mengukur perbandingan waktu komputasi murni ($T_{\text{comp}}$) terhadap waktu overhead komunikasi data ($T_{\text{comm}}$).
3. **Analisis Skalabilitas (Strong & Weak Scaling):** Menguji variasi proses $P \in \{1, 2, 4, 8, 16\}$ untuk menganalisis hukum Amdahl (*Amdahl's Law*), *Speedup Ratio* ($S$), dan *Parallel Efficiency* ($E$).
4. **Simulasi Toleransi Kesalahan (Fault Tolerance):** Menguji ketahanan sistem dengan simulasi *node failure* di tengah eksekusi dan mekanisme pemulihan dinamis (*dynamic task rescheduling*).

---

## 🏛️ Arsitektur Sistem

Sistem dirancang mengacu pada Bagian B lembar soal UAS:

```
                  +-----------------------------------+
                  |    MASTER NODE (Rank 0)           |
                  | - Task Scheduler & Coordinator    |
                  | - Matrix Generator & Scatter/Bcast|
                  | - Result Gathering & Checksum     |
                  +-----------------+-----------------+
                                    |
          +-------------------------+-------------------------+
          | (MPI_Scatterv Matrix A) | (MPI_Bcast Matrix B)    |
          v                         v                         v
+-------------------+     +-------------------+     +-------------------+
|  WORKER NODE 1    |     |  WORKER NODE 2    |     |  WORKER NODE (P-1)|
|  (Rank 1)         |     |  (Rank 2)         |     |  (Rank P-1)       |
| - Local Row A     |     | - Local Row A     |     | - Local Row A     |
| - Full Matrix B   |     | - Full Matrix B   |     | - Full Matrix B   |
| - Local Matmul C  |     | - Local Matmul C  |     | - Local Matmul C  |
+---------+---------+     +---------+---------+     +---------+---------+
          |                         |                         |
          +-------------------------+-------------------------+
                                    |
                         (MPI_Gatherv Sub-Matrix C)
                                    v
                  +-----------------------------------+
                  |    MASTER NODE (Rank 0)           |
                  | - Gabungkan Hasil Matrix C        |
                  | - Hitung Metrik T_comp & T_comm   |
                  | - Validasi Numerik (Frobenius)    |
                  +-----------------------------------+
```

### 1. Master/Coordinator Node (Rank 0)
* Menginisialisasi Matriks $A$ dan $B$ ($4096 \times 4096$) dengan tipe data `float32` (ukuran memori ~67.11 MB per matriks) menggunakan seed tetap (`seed=42`).
* Menghitung alokasi baris matriks ($N // P$) untuk setiap worker.
* Mendistribusikan data ke worker menggunakan buffer C-level MPI (`MPI.FLOAT`).
* Mengumpulkan kembali submatriks hasil dari seluruh worker ke matriks $C$.

### 2. Worker Node (Rank $1 \dots P-1$ dan Rank 0)
* Menerima broadcast Matriks $B$ secara utuh.
* Menerima potongan baris Matriks $A$ lokal ($local\_rows \times 4096$).
* Menghitung perkalian sub-matriks: $\text{local\_C} = \text{local\_A} \times B$ dengan BLAS teroptimasi (`np.matmul`).
* Mengirimkan potongan $\text{local\_C}$ kembali ke Master.

### 3. Communication Layer
* Menggunakan protokol MPI berbasis zero-copy memory buffer protocol:
  * `comm.Bcast(B, root=0)`: Penyiaran matriks $B$ efisien dengan kompleksitas $O(\log P)$.
  * `comm.Scatterv`: Pengiriman partisi baris matriks $A$ fleksibel untuk sembarang jumlah $P$.
  * `comm.Gatherv`: Pengumpulan matriks hasil $C$ kembali ke root.

---

## 📁 Struktur Direktori

```text
├── src/
│   ├── matrix_mul_mpi.py      # Program utama perkalian matriks MPI4Py terdistribusi
│   ├── benchmark_runner.py    # Runner otomatis pengujian multi-core (P = 1, 2, 4, 8, 16)
│   ├── plot_results.py        # Generator visualisasi grafik performa (300 DPI, IEEE Style)
│   └── fault_tolerance_sim.py # Simulasi toleransi kegagalan node (Node failure & recovery)
├── results/                   # Direktori output CSV dan gambar grafik hasil pengujian
├── requirements.txt           # Daftar dependensi pustaka Python
├── run_experiments.bat        # Skrip otomatis eksekusi 1-klik untuk Windows
├── run_experiments.sh         # Skrip otomatis eksekusi 1-klik untuk Linux / WSL / macOS
└── README.md                  # Dokumentasi teknis proyek
```

---

## ⚙️ Persyaratan Sistem & Instalasi

### 1. Kebutuhan Perangkat Lunak
* Python versi **3.8+** (disarankan 3.10 atau 3.11).
* Driver MPI terinstal pada sistem operasi:
  * **Windows:** [Microsoft MPI v10+ (msmpisetup.exe & msmpisdk.msi)](https://www.microsoft.com/en-us/download/details.aspx?id=105289)
  * **Linux / WSL / Ubuntu:** `sudo apt install libopenmpi-dev openmpi-bin`

### 2. Instalasi Pustaka Python
Jalankan perintah berikut di terminal:
```bash
pip install -r requirements.txt
```

---

## 🚀 Panduan Eksekusi Program

### A. Eksekusi Skrip 1-Klik (Rekomendasi)
* **Pada Windows:** Cukup klik dua kali `run_experiments.bat` atau jalankan di Command Prompt / PowerShell:
  ```cmd
  .\run_experiments.bat
  ```
* **Pada Linux / WSL:**
  ```bash
  chmod +x run_experiments.sh
  ./run_experiments.sh
  ```

---

### B. Menjalankan Modul Secara Manual

#### 1. Uji Tunggal Perkalian Matriks ($4096 \times 4096$)
Menjalankan perkalian dengan 4 proses MPI:
* **Windows:**
  ```powershell
  mpiexec -n 4 python src/matrix_mul_mpi.py --size 4096 --csv results/benchmark_results.csv --verify
  ```
* **Linux / WSL:**
  ```bash
  mpirun -n 4 python3 src/matrix_mul_mpi.py --size 4096 --csv results/benchmark_results.csv --verify
  ```

*Opsi argumen yang tersedia:*
* `--size <N>` : Dimensi matriks $N \times N$ (default: `4096`).
* `--seed <S>` : Random seed generator (default: `42`).
* `--csv <path>`: Jalur file CSV untuk ekspor metrik benchmark.
* `--verify`   : Validasi numerik dengan perkalian sekuensial NumPy.
* `--save`     : Simpan matriks hasil $C$ ke file `.npy`.

---

#### 2. Uji Skalabilitas Otomatis (Strong Scaling & Weak Scaling)
Menjalankan variasi $P = 1, 2, 4, 8, 16$ otomatis, menghitung Speedup ($S$), Efisiensi ($E$), dan membuat grafik:
```bash
python src/benchmark_runner.py --processes 1 2 4 8 16 --size 4096
```

---

#### 3. Membuat Visualisasi Grafik Hasil Benchmark
Jika Anda sudah memiliki file `results/benchmark_summary.csv`, grafik dapat di-generate ulang dengan perintah:
```bash
python src/plot_results.py --summary-csv results/benchmark_summary.csv --output-dir results
```

Grafik yang dihasilkan di direktori `results/`:
1. `execution_time_vs_cores.png` : Kurva Waktu Total, Komputasi ($T_{\text{comp}}$), dan Komunikasi ($T_{\text{comm}}$).
2. `speedup_analysis.png` : Kurva Speedup aktual vs Ideal Linear Speedup ($S = P$).
3. `efficiency_analysis.png` : Kurva Efisiensi paralel ($E = S / P \times 100\%$).
4. `communication_bottleneck.png` : Grafik *Stacked Bar* perbandingan persentase komputasi vs overhead komunikasi (*Communication Bottleneck*).

---

#### 4. Uji Simulasi Fault Tolerance (Simulasi 1 Node Gagal)
Sesuai parameter pengujian F.5 (Simulasi kegagalan node dan pemulihan tugas):
* **Windows:**
  ```powershell
  mpiexec -n 4 python src/fault_tolerance_sim.py --size 2048 --fail-rank 2
  ```
* **Linux / WSL:**
  ```bash
  mpirun -n 4 python3 src/fault_tolerance_sim.py --size 2048 --fail-rank 2
  ```

---

## 📊 Parameter & Rumus Pengujian Performansi

Sesuai spesifikasi lembar soal (Bagian F):

1. **Speedup Ratio ($S$):**
   $$S = \frac{T_{\text{sekuensial}}}{T_{\text{paralel}}}$$
2. **Parallel Efficiency ($E$):**
   $$E = \frac{S}{P} = \frac{T_{\text{sekuensial}}}{P \times T_{\text{paralel}}}$$
3. **Throughput (GFLOPS):**
   Komputasi perkalian matriks $N \times N$ membutuhkan $2N^3$ operasi floating-point:
   $$\text{GFLOPS} = \frac{2 \times N^3}{T_{\text{total}} \times 10^9}$$
4. **Communication Overhead Ratio:**
   $$\% T_{\text{comm}} = \left( \frac{T_{\text{comm}}}{T_{\text{total}}} \right) \times 100\%$$

---

## 📝 Kerangka Laporan Akhir (IEEE Style Format)

Gunakan struktur berikut untuk penyusunan laporan UAS sesuai instruksi Bagian C:
1. **Pendahuluan:** Latar belakang kebutuhan komputasi matriks skala besar, batasan memori/cache CPU sekuensial, rumusan masalah, dan tujuan.
2. **Kajian Teori:** Konsep Message Passing Interface (MPI), Amdahl's Law, Gustafson's Law, Communication-to-Computation Ratio.
3. **Metodologi & Arsitektur:** Desain topologi klaster, alokasi memori buffer contiguous, mekanisme komunikasi kolektif (`Scatterv`, `Bcast`, `Gatherv`), dan algoritma dynamic fault recovery.
4. **Implementasi:** Penjelasan kode utama `matrix_mul_mpi.py` dan alur eksekusi master-worker.
5. **Pengujian dan Analisis Performansi:** Penyajian tabel data eksperimen $P \in \{1, 2, 4, 8, 16\}$, grafik speedup, grafik efisiensi, grafik breakdown bottleneck komunikasi, serta hasil uji fault tolerance.
6. **Kesimpulan & Saran:** Rangkuman temuan titik jenuh prosesor (*diminishing returns* akibat overhead komunikasi) dan saran optimasi lanjutan (misal: hybrid MPI+OpenMP atau algoritma Cannon 2D).
