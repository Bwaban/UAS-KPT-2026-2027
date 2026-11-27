import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Info, StopCircle } from "lucide-react";
import type { ExperimentParams, RunSummary } from "../types";
import { api } from "../lib/api";
import { formatNumber, formatPercent, formatSeconds } from "../lib/utils";
import {
  CommandPreview,
  FormError,
  LogTerminal,
  PageHeader,
  ParamForm,
  ProgressBar,
  RunButton,
  StageStepper,
} from "../components/UI";

const initialParams: ExperimentParams = {
  mode: "single",
  size: 4096,
  processes: [4],
  seed: 42,
  csvPath: "results/benchmark_results.csv",
  verify: true,
  save: false,
  threads: 4,
  weakScaling: true,
  trials: 20,
};

const stageNames = [
  "Inisialisasi matriks A dan B",
  "Broadcast matriks B",
  "Scatterv baris matriks A",
  "Perkalian matriks lokal",
  "Gatherv hasil matriks C",
  "Verifikasi hasil numerik",
];

export default function RunExperiment() {
  const location = useLocation();
  const [params, setParams] = useState<ExperimentParams>(() => {
    const state = location.state as Partial<ExperimentParams> | null;
    return state ? { ...initialParams, ...state } : initialParams;
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(-1);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState("");
  const cancelRef = useRef(false);

  const command = useMemo(() => {
    if (params.mode === "benchmark") {
      return `python src/benchmark_runner.py --processes ${params.processes.join(" ")} --size ${params.size}${
        params.weakScaling === false ? " --no-weak-scaling" : ""
      }`;
    }
    if (params.mode === "hybrid") {
      return `mpiexec -n ${params.processes[0] ?? 2} python src/matrix_mul_hybrid.py --size ${params.size} --threads ${params.threads ?? 4}`;
    }
    if (params.mode === "latency") {
      return `mpiexec -n 2 python src/latency_benchmark.py --trials ${params.trials ?? 20}`;
    }
    return `mpiexec -n ${params.processes[0] ?? 4} python src/matrix_mul_mpi.py --size ${params.size} --seed ${params.seed}${
      params.csvPath ? ` --csv ${params.csvPath}` : ""
    }${params.verify ? " --verify" : ""}${params.save ? " --save" : ""}`;
  }, [params]);

  const append = (message: string) =>
    setLogs((current) => [...current, `${new Date().toLocaleTimeString("id-ID", { hour12: false })}  ${message}`]);

  const run = async () => {
    setRunning(true);
    setProgress(8);
    setStage(0);
    setSummary(null);
    setError("");
    setLogs([]);
    cancelRef.current = false;
    let disconnectLogs: () => void = () => {};
    try {
      const live = api.isLiveBackend();
      disconnectLogs = api.connectLogs((line) => {
        setLogs((current) => [...current, line]);
        if (line.includes("Inisialisasi") || line.includes("FASE 1")) { setStage(1); setProgress(25); }
        else if (line.includes("fase komputasi") || line.includes("FASE 2") || line.includes("1 MB")) { setStage(3); setProgress(62); }
        else if (line.includes("HASIL PENGUJIAN") || line.includes("RINGKASAN") || line.includes("tersimpan")) { setStage(5); setProgress(92); }
      });

      if (live) {
        append(`[api] Menjalankan langsung di server: ${command}`);
      } else {
        for (let index = 0; index < stageNames.length; index += 1) {
          if (cancelRef.current) {
            append("[galat] Eksekusi dibatalkan oleh pengguna.");
            setStage(index);
            return;
          }
          setStage(index);
          append(`[mpi] ${stageNames[index]}...`);
          await new Promise((resolve) => window.setTimeout(resolve, params.mode === "benchmark" ? 360 : 280));
          if (cancelRef.current) {
            append("[galat] Eksekusi dibatalkan oleh pengguna.");
            return;
          }
          append(`[✓] ${stageNames[index]} selesai.`);
          setProgress(Math.round(((index + 1) / stageNames.length) * 100));
        }
      }

      let result: RunSummary;
      if (params.mode === "benchmark") {
        const rows = await api.benchmark(params);
        const row = rows[rows.length - 1];
        if (!row) throw new Error("Tidak ada konfigurasi benchmark yang berhasil dijalankan.");
        result = {
          total: row.t_total_s,
          communication: row.comm_percent,
          gflops: row.throughput_gflops,
          verified: true,
        };
      } else if (params.mode === "hybrid") {
        result = await api.hybrid(params);
      } else if (params.mode === "latency") {
        result = await api.latency(params);
      } else {
        result = await api.run(params);
      }

      setStage(stageNames.length - 1);
      setProgress(100);
      setSummary(result);
      append(
        params.mode === "latency"
          ? `[✓] Selesai · Latency 64 MB ${formatSeconds(result.total)} · Peak ${formatNumber(result.gflops, 1)} MB/s`
          : `[✓] Selesai · T_total ${formatSeconds(result.total)} · ${formatNumber(result.gflops, 1)} GFLOPS`,
      );
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Terjadi kesalahan saat menjalankan eksperimen.";
      setError(message);
      append(`[galat] ${message}`);
    } finally {
      disconnectLogs();
      setRunning(false);
    }
  };

  const cancel = () => {
    cancelRef.current = true;
  };

  return (
    <div className="page run-page">
      <PageHeader
        title="Jalankan eksperimen"
        description="Eksekusi Pure MPI, Strong + Weak Scaling, Hybrid MPI+OpenMP, dan Ping-Pong Latency langsung dari browser."
        actions={
          <Link className="button-secondary" to="/hasil">
            <span>Hasil tersimpan</span>
            <ArrowUpRight size={14} strokeWidth={1.6} />
          </Link>
        }
      />

      <div className="run-layout">
        <div className="run-controls">
          <section className="panel form-panel">
            <div className="panel-heading">
              <div>
                <h2>Parameter komputasi</h2>
                <p>Pilih jenis pengujian UAS dan konfigurasi eksekusi</p>
              </div>
            </div>
            <ParamForm value={params} onChange={setParams} disabled={running} />
          </section>

          <CommandPreview command={command} />

          <div className="run-actions">
            <RunButton onClick={run} busy={running} disabled={params.processes.length === 0}>
              {running ? "Menjalankan..." : "Jalankan dari Web"}
            </RunButton>
            {running && (
              <button type="button" className="button-danger-ghost" onClick={cancel}>
                <StopCircle size={15} strokeWidth={1.6} />
                <span>Batalkan</span>
              </button>
            )}
          </div>

          {error && (
            <FormError message={`${error}. Periksa konfigurasi MPI dan koneksi backend, lalu coba lagi.`} />
          )}

          <p className="helper-text">
            <Info size={14} strokeWidth={1.6} />
            <span>
              {api.isLiveBackend()
                ? "Mode Live API aktif — semua tombol mengeksekusi MPI4Py sungguhan dan menyimpan hasil ke results/."
                : "Buka lewat start_web.bat (http://localhost:8000) agar semua eksperimen berjalan langsung di MPI4Py."}
            </span>
          </p>
        </div>

        <div className="run-monitor">
          <section className="panel run-progress-panel">
            <div className="panel-heading">
              <div>
                <h2>Progres eksekusi</h2>
                <p>
                  {running
                    ? "Proses MPI sedang berjalan"
                    : summary
                      ? "Seluruh fase komputasi selesai"
                      : "Menunggu eksekusi"}
                </p>
              </div>
              <span className={`run-state mono ${running ? "running" : summary ? "done" : ""}`}>
                {running ? "Berjalan" : summary ? "Selesai" : "Siap"}
              </span>
            </div>

            <StageStepper current={stage < 0 ? 0 : stage + (summary ? 1 : 0)} error={Boolean(error)} />

            <div className="progress-caption">
              <span>Progres keseluruhan</span>
              <strong className="mono">{progress}%</strong>
            </div>
            <ProgressBar value={progress} tone={summary ? "compute" : "accent"} />
          </section>

          <LogTerminal lines={logs} running={running} />

          {summary && (
            <section className="result-summary">
              <div className="summary-title">
                <CheckCircle2 size={16} strokeWidth={1.8} />
                <h2>Ringkasan hasil</h2>
              </div>
              <div className="summary-metrics">
                <div>
                  <small>{params.mode === "latency" ? "Latency 64 MB" : "Waktu total"}</small>
                  <strong className="mono">{formatSeconds(summary.total)}</strong>
                </div>
                <div>
                  <small>Komunikasi</small>
                  <strong className="metric-comm mono">{formatPercent(summary.communication)}</strong>
                </div>
                <div>
                  <small>{params.mode === "latency" ? "Peak Bandwidth" : "Throughput"}</small>
                  <strong className="mono">
                    {formatNumber(summary.gflops, 1)}{" "}
                    <small>{params.mode === "latency" ? "MB/s" : "GFLOPS"}</small>
                  </strong>
                </div>
                <div>
                  <small>Status</small>
                  <strong className={summary.verified ? "metric-compute" : ""}>
                    {summary.verified ? "Valid" : "Selesai"}
                  </strong>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
