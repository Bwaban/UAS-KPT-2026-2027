#!/usr/bin/env python3
"""
========================================================================================
FastAPI Unified Server untuk MPI Matrix Lab (UAS KPT 2026/2027)
Single Source of Truth: setiap eksekusi MPI otomatis menyinkronkan benchmark_results.csv,
benchmark_summary.csv, riwayat terbaru (/api/recent), dan seluruh grafik.
========================================================================================
"""

import asyncio
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import List, Optional, Set

import pandas as pd
import psutil
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).resolve().parent.parent
RESULTS_DIR = ROOT_DIR / "results"
SRC_DIR = ROOT_DIR / "src"
DIST_DIR = ROOT_DIR / "dist"

app = FastAPI(title="MPI Matrix Lab API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExperimentParams(BaseModel):
    mode: str = "single"
    size: int = Field(default=4096, ge=64, le=16384)
    processes: List[int] = Field(default=[4], min_length=1)
    seed: int = 42
    csvPath: str = "results/benchmark_results.csv"
    verify: bool = True
    save: bool = False
    threads: int = Field(default=2, ge=1, le=32)
    weakScaling: bool = True
    trials: int = Field(default=20, ge=5, le=100)


class FaultParams(BaseModel):
    size: int = Field(default=2048, ge=256, le=8192)
    processes: int = Field(default=4, ge=3, le=16)
    failRank: int = Field(default=2, ge=1, le=15)


class LogBroadcaster:
    def __init__(self) -> None:
        self.clients: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, message: str) -> None:
        dead = []
        for ws in list(self.clients):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)


broadcaster = LogBroadcaster()


def detect_mpi_command() -> Optional[str]:
    for cmd in ("mpiexec", "mpirun"):
        if shutil.which(cmd) is not None:
            return cmd
    return None


def mpi_launch_prefix(mpi_cmd: str, processes: int) -> List[str]:
    prefix = [mpi_cmd]
    if sys.platform != "win32":
        prefix.append("--oversubscribe")
    prefix.extend(["-n", str(processes)])
    return prefix


def safe_csv_path(relative_path: str) -> Path:
    candidate = (ROOT_DIR / relative_path).resolve()
    if RESULTS_DIR.resolve() not in candidate.parents and candidate.parent != RESULTS_DIR.resolve():
        raise HTTPException(status_code=400, detail="Jalur CSV harus berada di dalam direktori results/.")
    return candidate


async def run_and_stream(cmd: List[str]) -> tuple[int, str, float]:
    """Menjalankan subprocess MPI nyata di thread sambil streaming stdout ke WebSocket."""
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
    lines: List[str] = []
    return_code_holder: List[int] = [1]

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    t0 = time.perf_counter()

    def worker() -> None:
        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(ROOT_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
            )
            assert proc.stdout is not None
            for raw in iter(proc.stdout.readline, b""):
                text = raw.decode("utf-8", errors="replace").rstrip()
                if text:
                    lines.append(text)
                    loop.call_soon_threadsafe(queue.put_nowait, text)
            proc.stdout.close()
            return_code_holder[0] = proc.wait()
        except Exception as exc:
            err_msg = f"[galat] Gagal menjalankan subprocess: {exc}"
            lines.append(err_msg)
            loop.call_soon_threadsafe(queue.put_nowait, err_msg)
            return_code_holder[0] = 1
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    while True:
        item = await queue.get()
        if item is None:
            break
        await broadcaster.broadcast(item)

    thread.join(timeout=5)
    wall_clock = time.perf_counter() - t0
    return return_code_holder[0], "\n".join(lines), wall_clock


def sync_summary_from_raw(
    raw_csv: Path = RESULTS_DIR / "benchmark_results.csv",
    summary_csv: Path = RESULTS_DIR / "benchmark_summary.csv",
) -> list[dict]:
    """
    Sinkronisasi otomatis: mengambil rekaman TERBARU untuk tiap (matrix_size, processes)
    dari benchmark_results.csv, menghitung ulang Speedup & Efisiensi per matrix_size,
    lalu menulis ulang benchmark_summary.csv agar Dashboard, Benchmark, dan Eksperimen
    selalu 100% sinkron.
    """
    if not raw_csv.exists():
        return []
    df = pd.read_csv(raw_csv)
    if df.empty:
        return []

    # Ambil hasil paling baru per (matrix_size, processes)
    latest = (
        df.groupby(["matrix_size", "processes"], as_index=False)
        .last()
        .sort_values(["matrix_size", "processes"])
    )

    summary_rows: list[dict] = []
    for m_size, group in latest.groupby("matrix_size"):
        group = group.sort_values("processes")
        base_rows = group[group["processes"] == 1]
        t_seq = float(base_rows.iloc[0]["t_total_s"]) if not base_rows.empty else float(group.iloc[0]["t_total_s"])

        for _, r in group.iterrows():
            p = int(r["processes"])
            t_total = float(r["t_total_s"])
            speedup = (t_seq / t_total) if t_total > 0 else 0.0
            efficiency = (speedup / p) if p > 0 else 0.0
            summary_rows.append({
                "matrix_size": int(m_size),
                "processes": p,
                "t_total_s": t_total,
                "t_comp_s": float(r.get("t_comp_max_s", r.get("t_comp_s", 0.0))),
                "t_comm_s": float(r.get("t_comm_max_s", r.get("t_comm_s", 0.0))),
                "t_comm_in_s": float(r.get("t_comm_in_s", 0.0)),
                "t_comm_out_s": float(r.get("t_comm_out_s", 0.0)),
                "comp_percent": float(r.get("comp_percent", 0.0)),
                "comm_percent": float(r.get("comm_percent", 0.0)),
                "speedup": speedup,
                "efficiency": efficiency,
                "throughput_gflops": float(r.get("gflops", r.get("throughput_gflops", 0.0))),
            })

    summary_df = pd.DataFrame(summary_rows)
    summary_df.to_csv(summary_csv, index=False)
    return [{**row, "executed": True} for row in summary_rows]


def read_summary_rows(csv_path: Path) -> list[dict]:
    if not csv_path.exists():
        return []
    df = pd.read_csv(csv_path)
    if df.empty:
        return []

    # Jika membaca file raw benchmark_results.csv, hitung speedup/efisiensi on-the-fly
    if "speedup" not in df.columns:
        return sync_summary_from_raw(csv_path, RESULTS_DIR / "benchmark_summary.csv")

    rows = []
    for _, r in df.iterrows():
        rows.append({
            "matrix_size": int(r["matrix_size"]),
            "processes": int(r["processes"]),
            "t_total_s": float(r.get("t_total_s", 0.0)),
            "t_comp_s": float(r.get("t_comp_s", r.get("t_comp_max_s", 0.0))),
            "t_comm_s": float(r.get("t_comm_s", r.get("t_comm_max_s", 0.0))),
            "t_comm_in_s": float(r.get("t_comm_in_s", 0.0)),
            "t_comm_out_s": float(r.get("t_comm_out_s", 0.0)),
            "comp_percent": float(r.get("comp_percent", 0.0)),
            "comm_percent": float(r.get("comm_percent", 0.0)),
            "speedup": float(r.get("speedup", 1.0)),
            "efficiency": float(r.get("efficiency", 1.0)),
            "throughput_gflops": float(r.get("throughput_gflops", r.get("gflops", 0.0))),
            "executed": True,
        })
    return rows


def read_recent_runs(limit: int = 10) -> list[dict]:
    raw_csv = RESULTS_DIR / "benchmark_results.csv"
    if not raw_csv.exists():
        return []
    df = pd.read_csv(raw_csv)
    if df.empty:
        return []
    tail = df.tail(limit).iloc[::-1]
    runs = []
    for idx, r in tail.iterrows():
        runs.append({
            "id": f"RUN-{int(idx) + 1:03d}",
            "size": int(r["matrix_size"]),
            "processes": int(r["processes"]),
            "duration": float(r["t_total_s"]),
            "communication": float(r["comm_percent"]),
            "gflops": float(r["gflops"]),
            "status": "Selesai",
            "date": str(r.get("timestamp", "")),
        })
    return runs


@app.get("/api/system")
def get_system():
    mpi_cmd = detect_mpi_command()
    ram = psutil.virtual_memory()
    net = psutil.net_io_counters()
    return {
        "mpi_available": mpi_cmd is not None,
        "mpi_cmd": mpi_cmd or "Tidak terdeteksi",
        "python_version": platform.python_version(),
        "cpu_physical": psutil.cpu_count(logical=False) or 1,
        "cpu_logical": psutil.cpu_count(logical=True) or 1,
        "cpu_percent": round(psutil.cpu_percent(interval=0.05), 1),
        "ram_percent": round(ram.percent, 1),
        "ram_used_mb": round(ram.used / (1024 * 1024)),
        "ram_total_mb": round(ram.total / (1024 * 1024)),
        "net_sent_mb": round(net.bytes_sent / (1024 * 1024), 1),
        "net_recv_mb": round(net.bytes_recv / (1024 * 1024), 1),
    }


@app.get("/api/results")
def get_results(source: str = Query(default="results/benchmark_summary.csv")):
    return read_summary_rows(safe_csv_path(source))


@app.get("/api/recent")
def get_recent(limit: int = Query(default=10, ge=1, le=50)):
    return read_recent_runs(limit)


@app.get("/api/extra")
def get_extra_metrics():
    def load_csv(name: str) -> list[dict]:
        path = RESULTS_DIR / name
        if not path.exists():
            return []
        return pd.read_csv(path).to_dict(orient="records")

    fault_log_path = RESULTS_DIR / "fault_tolerance_log.txt"
    fault_log = fault_log_path.read_text(encoding="utf-8") if fault_log_path.exists() else ""

    return {
        "weak_scaling": load_csv("weak_scaling_summary.csv"),
        "latency": load_csv("latency_results.csv"),
        "hybrid": load_csv("hybrid_mpi_openmp_results.csv"),
        "fault_log": fault_log,
        "recent_runs": read_recent_runs(10),
    }


@app.post("/api/run")
async def run_single(params: ExperimentParams):
    mpi_cmd = detect_mpi_command()
    if not mpi_cmd:
        raise HTTPException(status_code=500, detail="mpiexec / mpirun tidak terdeteksi di server.")

    p = max(1, min(16, params.processes[0]))
    csv_path = safe_csv_path(params.csvPath or "results/benchmark_results.csv")
    cmd = [
        *mpi_launch_prefix(mpi_cmd, p), sys.executable, str(SRC_DIR / "matrix_mul_mpi.py"),
        "--size", str(params.size), "--seed", str(params.seed), "--csv", str(csv_path),
    ]
    if params.verify:
        cmd.append("--verify")
    if params.save:
        cmd.append("--save")

    code, output, wall_clock = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Eksekusi MPI gagal (exit {code}).")

    # Sinkronkan benchmark_summary.csv segera agar Dashboard & Benchmark langsung update!
    if csv_path == (RESULTS_DIR / "benchmark_results.csv").resolve():
        sync_summary_from_raw(csv_path, RESULTS_DIR / "benchmark_summary.csv")

    total_m = re.search(r"Total Waktu Eksekusi \(T_total\):\s*([\d.]+)", output)
    comm_m = re.search(r"Rasio Overhead Komunikasi\s*:\s*([\d.]+)%", output)
    gflops_m = re.search(r"Throughput Performa\s*:\s*([\d.]+)", output)
    seq_m = re.search(r"Waktu NumPy Sekuensial\s*:\s*([\d.]+)", output)

    return {
        "total": float(total_m.group(1)) if total_m else 0.0,
        "wall_clock": round(wall_clock, 4),
        "seq_time": float(seq_m.group(1)) if seq_m else None,
        "communication": float(comm_m.group(1)) if comm_m else 0.0,
        "gflops": float(gflops_m.group(1)) if gflops_m else 0.0,
        "verified": "SUKSES (IDENTIK)" in output if params.verify else False,
    }


@app.post("/api/benchmark")
async def run_benchmark(params: ExperimentParams):
    mpi_cmd = detect_mpi_command()
    if not mpi_cmd:
        raise HTTPException(status_code=500, detail="mpiexec / mpirun tidak terdeteksi di server.")

    procs = [str(max(1, min(16, p))) for p in sorted(set(params.processes))]
    cmd = [
        sys.executable, str(SRC_DIR / "benchmark_runner.py"),
        "--processes", *procs, "--size", str(params.size),
    ]
    if not params.weakScaling:
        cmd.append("--no-weak-scaling")

    code, _, _ = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Benchmark scaling gagal (exit {code}).")
    return read_summary_rows(RESULTS_DIR / "benchmark_summary.csv")


@app.post("/api/hybrid")
async def run_hybrid(params: ExperimentParams):
    mpi_cmd = detect_mpi_command()
    if not mpi_cmd:
        raise HTTPException(status_code=500, detail="mpiexec / mpirun tidak terdeteksi di server.")

    p = max(1, min(16, params.processes[0]))
    t = max(1, min(16, params.threads))
    cmd = [
        *mpi_launch_prefix(mpi_cmd, p), sys.executable, str(SRC_DIR / "matrix_mul_hybrid.py"),
        "--size", str(params.size), "--threads", str(t), "--seed", str(params.seed),
    ]
    code, output, wall_clock = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Eksekusi Hybrid MPI+OpenMP gagal (exit {code}).")

    total_m = re.search(r"Total Waktu Eksekusi \(T_total\):\s*([\d.]+)", output)
    comm_m = re.search(r"Overhead Komunikasi\(T_comm\):\s*[\d.]+ detik \(([\d.]+)%\)", output)
    gflops_m = re.search(r"Throughput Performa\s*:\s*([\d.]+)", output)
    return {
        "total": float(total_m.group(1)) if total_m else 0.0,
        "wall_clock": round(wall_clock, 4),
        "communication": float(comm_m.group(1)) if comm_m else 0.0,
        "gflops": float(gflops_m.group(1)) if gflops_m else 0.0,
        "verified": "Frobenius Norm" in output,
    }


@app.post("/api/latency")
async def run_latency(params: ExperimentParams):
    mpi_cmd = detect_mpi_command()
    if not mpi_cmd:
        raise HTTPException(status_code=500, detail="mpiexec / mpirun tidak terdeteksi di server.")

    cmd = [
        *mpi_launch_prefix(mpi_cmd, 2), sys.executable, str(SRC_DIR / "latency_benchmark.py"),
        "--trials", str(params.trials),
    ]
    code, _, wall_clock = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Benchmark latency gagal (exit {code}).")

    lat_csv = RESULTS_DIR / "latency_results.csv"
    rows = pd.read_csv(lat_csv).to_dict(orient="records") if lat_csv.exists() else []
    peak_bw = max((float(r["bandwidth_mbps"]) for r in rows), default=0.0)
    last_lat_s = float(rows[-1]["latency_ms"]) / 1000.0 if rows else 0.0
    return {
        "total": last_lat_s,
        "wall_clock": round(wall_clock, 4),
        "communication": 100.0,
        "gflops": round(peak_bw, 2),
        "verified": len(rows) > 0,
        "rows": rows,
    }


@app.post("/api/fault")
async def run_fault(params: FaultParams):
    mpi_cmd = detect_mpi_command()
    if not mpi_cmd:
        raise HTTPException(status_code=500, detail="mpiexec / mpirun tidak terdeteksi di server.")
    if params.failRank >= params.processes:
        raise HTTPException(status_code=400, detail="failRank harus lebih kecil dari jumlah proses.")

    cmd = [
        *mpi_launch_prefix(mpi_cmd, params.processes), sys.executable, str(SRC_DIR / "fault_tolerance_sim.py"),
        "--size", str(params.size), "--fail-rank", str(params.failRank),
    ]
    code, output, wall_clock = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Simulasi fault tolerance gagal (exit {code}).")

    dur_m = re.search(r"Total Waktu Eksekusi \+ Recovery\s*:\s*([\d.]+)", output)
    rec_m = re.search(r"Waktu Penjadwalan Ulang \(Recovery\):\s*([\d.]+)", output)
    completed = [r for r in range(1, params.processes) if r != params.failRank]
    return {
        "recovered": "SUKSES" in output,
        "integrity": "100% IDENTIK (VALID)" in output,
        "duration": float(dur_m.group(1)) if dur_m else 0.0,
        "wall_clock": round(wall_clock, 4),
        "recovery": float(rec_m.group(1)) if rec_m else 0.0,
        "completedBy": completed,
    }


@app.websocket("/ws/log")
async def websocket_log(ws: WebSocket):
    await broadcaster.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(ws)


if (DIST_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(DIST_DIR / "assets")), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith(("api/", "ws/")):
        raise HTTPException(status_code=404, detail="Endpoint tidak ditemukan.")
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Frontend dist/ belum di-build. Jalankan: npm run build")
