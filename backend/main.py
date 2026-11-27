#!/usr/bin/env python3
"""
========================================================================================
FastAPI Unified Server untuk MPI Matrix Lab (UAS KPT 2026/2027)
Menjalankan seluruh eksperimen MPI/OpenMP/Latency/Fault langsung dari Web UI +
melayani frontend React (dist/) dalam satu proses di http://localhost:8000
========================================================================================
"""

import asyncio
import platform
import re
import shutil
import sys
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

app = FastAPI(title="MPI Matrix Lab API", version="1.1.0")

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


def safe_csv_path(relative_path: str) -> Path:
    candidate = (ROOT_DIR / relative_path).resolve()
    if RESULTS_DIR.resolve() not in candidate.parents and candidate.parent != RESULTS_DIR.resolve():
        raise HTTPException(status_code=400, detail="Jalur CSV harus berada di dalam direktori results/.")
    return candidate


async def run_and_stream(cmd: List[str]) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(ROOT_DIR),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    lines: List[str] = []
    assert proc.stdout is not None
    while True:
        raw = await proc.stdout.readline()
        if not raw:
            break
        text = raw.decode("utf-8", errors="replace").rstrip()
        if text:
            lines.append(text)
            await broadcaster.broadcast(text)
    code = await proc.wait()
    return code, "\n".join(lines)


def read_summary_rows(csv_path: Path) -> list[dict]:
    if not csv_path.exists():
        return []
    df = pd.read_csv(csv_path)
    if df.empty:
        return []
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


@app.get("/api/system")
def get_system():
    mpi_cmd = detect_mpi_command()
    ram = psutil.virtual_memory()
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
    }


@app.get("/api/results")
def get_results(source: str = Query(default="results/benchmark_summary.csv")):
    return read_summary_rows(safe_csv_path(source))


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
    }


@app.post("/api/run")
async def run_single(params: ExperimentParams):
    mpi_cmd = detect_mpi_command()
    if not mpi_cmd:
        raise HTTPException(status_code=500, detail="mpiexec / mpirun tidak terdeteksi di server.")

    p = max(1, min(16, params.processes[0]))
    csv_path = safe_csv_path(params.csvPath or "results/benchmark_results.csv")
    cmd = [
        mpi_cmd, "-n", str(p), sys.executable, str(SRC_DIR / "matrix_mul_mpi.py"),
        "--size", str(params.size), "--seed", str(params.seed), "--csv", str(csv_path),
    ]
    if params.verify:
        cmd.append("--verify")
    if params.save:
        cmd.append("--save")

    code, output = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Eksekusi MPI gagal (exit {code}).")

    total_m = re.search(r"Total Waktu Eksekusi \(T_total\):\s*([\d.]+)", output)
    comm_m = re.search(r"Rasio Overhead Komunikasi\s*:\s*([\d.]+)%", output)
    gflops_m = re.search(r"Throughput Performa\s*:\s*([\d.]+)", output)
    return {
        "total": float(total_m.group(1)) if total_m else 0.0,
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

    code, _ = await run_and_stream(cmd)
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
        mpi_cmd, "-n", str(p), sys.executable, str(SRC_DIR / "matrix_mul_hybrid.py"),
        "--size", str(params.size), "--threads", str(t), "--seed", str(params.seed),
    ]
    code, output = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Eksekusi Hybrid MPI+OpenMP gagal (exit {code}).")

    total_m = re.search(r"Total Waktu Eksekusi \(T_total\):\s*([\d.]+)", output)
    comm_m = re.search(r"Overhead Komunikasi\(T_comm\):\s*[\d.]+ detik \(([\d.]+)%\)", output)
    gflops_m = re.search(r"Throughput Performa\s*:\s*([\d.]+)", output)
    return {
        "total": float(total_m.group(1)) if total_m else 0.0,
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
        mpi_cmd, "-n", "2", sys.executable, str(SRC_DIR / "latency_benchmark.py"),
        "--trials", str(params.trials),
    ]
    code, _ = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Benchmark latency gagal (exit {code}).")

    lat_csv = RESULTS_DIR / "latency_results.csv"
    rows = pd.read_csv(lat_csv).to_dict(orient="records") if lat_csv.exists() else []
    peak_bw = max((float(r["bandwidth_mbps"]) for r in rows), default=0.0)
    last_lat_s = float(rows[-1]["latency_ms"]) / 1000.0 if rows else 0.0
    return {
        "total": last_lat_s,
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
        mpi_cmd, "-n", str(params.processes), sys.executable, str(SRC_DIR / "fault_tolerance_sim.py"),
        "--size", str(params.size), "--fail-rank", str(params.failRank),
    ]
    code, output = await run_and_stream(cmd)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"Simulasi fault tolerance gagal (exit {code}).")

    dur_m = re.search(r"Total Waktu Eksekusi \+ Recovery\s*:\s*([\d.]+)", output)
    rec_m = re.search(r"Waktu Penjadwalan Ulang \(Recovery\):\s*([\d.]+)", output)
    completed = [r for r in range(1, params.processes) if r != params.failRank]
    return {
        "recovered": "SUKSES" in output,
        "integrity": "100% IDENTIK (VALID)" in output,
        "duration": float(dur_m.group(1)) if dur_m else 0.0,
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


# Sajikan frontend React build (dist/) langsung dari server yang sama (http://localhost:8000)
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
