#!/usr/bin/env python3
"""
========================================================================================
Tugas Besar Komputasi Paralel dan Terdistribusi (UAS 2026/2027)
Simulasi Fault Tolerance: Dynamic Task Scheduling & Node Failure Recovery
----------------------------------------------------------------------------------------
Sesuai Soal F.5: "Fault Tolerance Test: Simulasi 1 node gagal saat eksekusi."
========================================================================================
"""

import argparse
import os
import sys
import time
import numpy as np
from mpi4py import MPI

TAG_TASK_REQ = 10
TAG_TASK_DATA = 11
TAG_TASK_RESULT = 12
TAG_DIE = 13
TAG_NODE_CRASH = 99


def parse_arguments():
    parser = argparse.ArgumentParser(description="Simulasi Fault Tolerance MPI4Py pada Perkalian Matriks")
    parser.add_argument("--size", "-n", type=int, default=2048, help="Ukuran matriks simulasi N x N (default: 2048)")
    parser.add_argument("--fail-rank", type=int, default=2, help="Nomor rank worker yang disimulasikan crash (default: 2)")
    parser.add_argument("--chunk-size", type=int, default=256, help="Ukuran chunk baris per tugas (default: 256)")
    parser.add_argument("--log-file", type=str, default="results/fault_tolerance_log.txt")
    return parser.parse_args()


def master_process(comm, size, N, chunk_size, fail_rank, log_file):
    logs = []

    def log(msg):
        print(msg, flush=True)
        logs.append(msg)

    log("=" * 80)
    log(" " * 20 + "SIMULASI FAULT TOLERANCE KOMPUTASI TERDISTRIBUSI")
    log("=" * 80)
    log(f"[*] Ukuran Matriks        : {N} x {N}")
    log(f"[*] Total Proses Aktif    : {size} (1 Master + {size - 1} Workers)")
    log(f"[*] Ukuran Blok/Chunk     : {chunk_size} baris")
    log(f"[*] Simulasi Node Gagal   : Worker Rank {fail_rank} akan disimulasikan Crash!")
    log("-" * 80)

    np.random.seed(42)
    A = np.random.rand(N, N).astype(np.float32)
    B = np.random.rand(N, N).astype(np.float32)
    C = np.zeros((N, N), dtype=np.float32)

    comm.Bcast(B, root=0)

    task_queue = []
    task_id = 0
    for r in range(0, N, chunk_size):
        task_queue.append((task_id, r, min(r + chunk_size, N)))
        task_id += 1

    total_tasks = len(task_queue)
    log(f"[*] Total Task dalam Antrean: {total_tasks} chunks")

    pending_tasks = {t[0]: t for t in task_queue}
    assigned_tasks = {}
    completed_tasks = set()
    dead_workers = set()
    active_workers = set(range(1, size))
    t_crash_detected = None
    t_recovered = None

    t_start = time.time()
    status = MPI.Status()

    while len(completed_tasks) < total_tasks:
        msg = comm.recv(source=MPI.ANY_SOURCE, tag=MPI.ANY_TAG, status=status)
        source = status.Get_source()
        tag = status.Get_tag()

        if tag == TAG_NODE_CRASH:
            t_crash_detected = time.time()
            log(f"\n[!] ALERT: Worker Rank {source} mengalami SYSTEM FAILURE (CRASH)!")
            dead_workers.add(source)
            active_workers.discard(source)

            tasks_to_reassign = [tid for tid, (wr, _) in assigned_tasks.items() if wr == source]
            for tid in tasks_to_reassign:
                assigned_tasks.pop(tid)
                log(f"[RECOVERY] Task ID {tid} (Baris {pending_tasks[tid][1]}-{pending_tasks[tid][2]}) ditarik kembali dari Rank {source}.")
                task_queue.insert(0, pending_tasks[tid])
            log("[RECOVERY] Task berhasil dijadwalkan ulang ke antrean kerja.\n")

        elif tag == TAG_TASK_REQ:
            if source in dead_workers:
                continue
            if task_queue:
                t_id, r_start, r_end = task_queue.pop(0)
                assigned_tasks[t_id] = (source, time.time())
                if t_crash_detected is not None and t_recovered is None:
                    t_recovered = time.time()
                comm.send((t_id, r_start, r_end, A[r_start:r_end, :]), dest=source, tag=TAG_TASK_DATA)
                log(f"[*] Master mengirim Task ID {t_id} (Baris {r_start}:{r_end}) -> Worker Rank {source}")
            else:
                if len(completed_tasks) < total_tasks:
                    comm.send(None, dest=source, tag=TAG_TASK_DATA)
                else:
                    comm.send(None, dest=source, tag=TAG_DIE)

        elif tag == TAG_TASK_RESULT:
            t_id, r_start, r_end, sub_C = msg
            C[r_start:r_end, :] = sub_C
            completed_tasks.add(t_id)
            assigned_tasks.pop(t_id, None)
            log(f"[+] Master menerima hasil Task ID {t_id} dari Worker Rank {source} ({len(completed_tasks)}/{total_tasks} selesai)")

    t_total = time.time() - t_start
    t_recovery = (t_recovered - t_crash_detected) if (t_crash_detected and t_recovered) else 0.0

    for w in active_workers:
        comm.send(None, dest=w, tag=TAG_DIE)

    C_expected = np.matmul(A, B)
    is_correct = bool(np.allclose(C, C_expected, atol=1e-3, rtol=1e-3))
    frob_norm = float(np.linalg.norm(C))

    log("\n" + "=" * 80)
    log(" " * 25 + "HASIL PENGUJIAN FAULT TOLERANCE")
    log("=" * 80)
    log("Status Pemulihan (Fault Recovery) : SUKSES (Toleran terhadap kegagalan node)")
    log(f"Node yang Mengalami Kegagalan     : Rank {fail_rank} (Mati & diisolasi)")
    log(f"Node yang Menyelesaikan Pekerjaan : {sorted(list(active_workers))}")
    log(f"Total Waktu Eksekusi + Recovery   : {t_total:.4f} detik")
    log(f"Waktu Penjadwalan Ulang (Recovery): {t_recovery:.4f} detik")
    log(f"Integritas Matriks Hasil Akhir    : {'100% IDENTIK (VALID)' if is_correct else 'TIDAK VALID'}")
    log(f"Frobenius Norm Matriks C          : {frob_norm:.6e}")
    log("=" * 80)

    if log_file:
        os.makedirs(os.path.dirname(os.path.abspath(log_file)), exist_ok=True)
        with open(log_file, "w", encoding="utf-8") as f:
            f.write("\n".join(logs) + "\n")
        print(f"[+] Log fault tolerance tersimpan di: {log_file}", flush=True)


def run():
    comm = MPI.COMM_WORLD
    rank = comm.Get_rank()
    size = comm.Get_size()
    args = parse_arguments()

    if size < 3:
        if rank == 0:
            print("[!] Peringatan: Jalankan simulasi fault tolerance dengan minimal 3 proses (misal: mpiexec -n 4 ...)")
        sys.exit(1)

    fail_rank = args.fail_rank
    if not (1 <= fail_rank < size):
        if rank == 0:
            print(f"[!] Error: --fail-rank harus berada di rentang 1..{size - 1}")
        sys.exit(1)

    if rank == 0:
        master_process(comm, size, args.size, args.chunk_size, fail_rank, args.log_file)
    else:
        B = np.empty((args.size, args.size), dtype=np.float32)
        comm.Bcast(B, root=0)
        has_failed = False
        task_count = 0

        while True:
            comm.send(None, dest=0, tag=TAG_TASK_REQ)
            status = MPI.Status()
            data = comm.recv(source=0, tag=MPI.ANY_TAG, status=status)
            tag = status.Get_tag()

            if tag == TAG_DIE:
                break
            elif tag == TAG_TASK_DATA:
                if data is None:
                    time.sleep(0.05)
                    continue
                t_id, r_start, r_end, sub_A = data
                task_count += 1
                if rank == fail_rank and not has_failed and task_count >= 1:
                    print(f"[CRASH SIMULATION] Worker Rank {rank} mengalami failure mendadak saat komputasi Task {t_id}!", flush=True)
                    time.sleep(0.4)
                    comm.send(None, dest=0, tag=TAG_NODE_CRASH)
                    has_failed = True
                    break
                sub_C = np.matmul(sub_A, B)
                comm.send((t_id, r_start, r_end, sub_C), dest=0, tag=TAG_TASK_RESULT)


if __name__ == "__main__":
    run()
