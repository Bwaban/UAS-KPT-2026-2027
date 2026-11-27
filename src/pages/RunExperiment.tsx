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
    if (params.mode === "benchmark")
      return `python src/benchmark_runner.py --processes ${params.processes.join(" ")} --size ${params.size}`;
    return `mpiexec -n ${params.processes[0]} python src/matrix_mul_mpi.py --size ${params.size} --seed ${params.seed}${
      params.csvPath ? ` --csv ${params.csvPath}` : ""
    }${params.verify ? " --verify" : ""}${params.save ? " --save" : ""}`;
  }, [params]);

  const append = (message: string) =>
    setLogs((current) => [...current, `${new Date().toLocaleTimeString("id-ID", { hour12: false })}  ${message}`]);

  const run = async () => {
    setRunning(true);
    setProgress(0);
    setStage(0);
    setSummary(null);
    setError("");
    setLogs([]);
    cancelRef.current = false;
    let disconnectLogs: () => void = () => {};
    try {
      disconnectLogs = api.connectLogs((line) => setLogs((current) => [...current, line]));
      for (let index = 0; index < stageNames.length; index += 1) {
        if (cancelRef.current) {
          append("[galat] Eksekusi dibatalkan oleh pengguna.");
          setStage(index);
          return;
        }
        setStage(index);
        append(`[mpi] ${stageNames[index]}...`);
        await new Promise((resolve) => window.setTimeout(resolve, params.mode === "benchmark" ? 480 : 380));
        if (cancelRef.current) {
          append("[galat] Eksekusi dibatalkan oleh pengguna.");
          return;
        }
        append(`[✓] ${stageNames[index]} selesai.`);
        setProgress(Math.round(((index + 1) / stageNames.length) * 100));
      }
      const result =
        params.mode === "benchmark"
          ? await api.benchmark(params).then((rows) => {
              const row = rows[rows.length - 1];
              if (!row) throw new Error("Tidak ada konfigurasi benchmark yang berhasil dijalankan.");
              return {
                total: row.t_total_s,
                communication: row.comm_percent,
                gflops: row.throughput_gflops,
                verified: params.verify,
              };
            })
          : await api.run(params);
      setSummary(result);
      append(`[✓] Selesai · T_total ${formatSeconds(result.total)} · ${formatNumber(result.gflops, 1)} GFLOPS`);
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
        description="Konfigurasi dimensi matriks, jumlah proses MPI, dan pantau setiap fase kolektif."
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
                <p>Pilih mode eksekusi dan alokasi proses</p>
              </div>
            </div>
            <ParamForm value={params} onChange={setParams} disabled={running} />
          </section>

          <CommandPreview command={command} />

          <div className="run-actions">
            <RunButton onClick={run} busy={running} disabled={params.processes.length === 0}>
              {running ? "Menjalankan..." : "Jalankan eksperimen"}
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
            <span>Mode mock aktif untuk pratinjau UI; atur VITE_USE_MOCK=false untuk backend FastAPI.</span>
          </p>
        </div>

        <div className="run-monitor">
          <section className="panel run-progress-panel">
            <div className="panel-heading">
              <div>
                <h2>Progres eksekusi</h2>
                <p>
                  {running
                    ? "Tahap MPI sedang berjalan"
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
                  <small>Waktu total</small>
                  <strong className="mono">{formatSeconds(summary.total)}</strong>
                </div>
                <div>
                  <small>Komunikasi</small>
                  <strong className="metric-comm mono">{formatPercent(summary.communication)}</strong>
                </div>
                <div>
                  <small>Throughput</small>
                  <strong className="mono">
                    {formatNumber(summary.gflops, 1)} <small>GFLOPS</small>
                  </strong>
                </div>
                <div>
                  <small>Validasi</small>
                  <strong className={summary.verified ? "metric-compute" : ""}>
                    {summary.verified ? "Lulus" : "Tidak aktif"}
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
