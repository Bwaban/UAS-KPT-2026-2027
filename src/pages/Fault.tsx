import { useEffect, useState } from "react";
import { CheckCircle2, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { api } from "../lib/api";
import { formatSeconds } from "../lib/utils";
import { EventTimeline, NodeGrid, PageHeader, ProgressBar, RunButton } from "../components/UI";
import type { TimelineEvent } from "../components/UI";

export default function Fault() {
  const [size, setSize] = useState(2048);
  const [processes, setProcesses] = useState(4);
  const [failRank, setFailRank] = useState(2);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failureTriggered, setFailureTriggered] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [savedLog, setSavedLog] = useState("");
  const [result, setResult] = useState<{
    recovered: boolean;
    integrity: boolean;
    duration: number;
    recovery: number;
    completedBy: number[];
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getExtra().then((extra) => {
      if (extra.fault_log) setSavedLog(extra.fault_log);
    }).catch(() => {});
  }, []);

  const addEvent = (label: string, tone: "danger" | "success" | "normal", detail: string) =>
    setEvents((current) => [
      ...current,
      { label, tone, detail, time: new Date().toLocaleTimeString("id-ID", { hour12: false }) },
    ]);

  const run = async () => {
    setRunning(true);
    setProgress(10);
    setResult(null);
    setError("");
    setEvents([]);
    setFailureTriggered(false);
    addEvent("Task dikirim ke worker", "normal", "8 chunk pekerjaan masuk ke antrean");
    let disconnectLogs: () => void = () => {};
    try {
      const live = api.isLiveBackend();
      if (live) {
        disconnectLogs = api.connectLogs((line) => {
          if (line.includes("CRASH")) {
            setFailureTriggered(true);
            setProgress(48);
            addEvent(`Crash terdeteksi pada Rank ${failRank}`, "danger", line);
          } else if (line.includes("[RECOVERY]")) {
            setProgress(70);
            addEvent("Task dijadwalkan ulang", "normal", line);
          }
        });
      } else {
        for (let percent = 12; percent <= 96; percent += 12) {
          await new Promise((resolve) => window.setTimeout(resolve, 220));
          if (percent === 36) {
            setFailureTriggered(true);
            addEvent(`Crash terdeteksi pada Rank ${failRank}`, "danger", "Worker tidak merespons · proses diisolasi");
          }
          if (percent === 48) addEvent("Task ditarik kembali", "normal", "Chunk yang belum selesai dikembalikan ke master");
          if (percent === 60) addEvent("Task dijadwalkan ulang", "normal", "Pekerjaan dialihkan ke worker aktif");
          setProgress(percent);
        }
      }
      const output = await api.fault({ size, processes, failRank });
      setFailureTriggered(true);
      setProgress(100);
      setResult(output);
      addEvent("Semua task selesai", "success", "Matriks C berhasil direkonstruksi dan diverifikasi");
      api.getExtra().then((extra) => {
        if (extra.fault_log) setSavedLog(extra.fault_log);
      }).catch(() => {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Simulasi gagal. Periksa konfigurasi lalu coba lagi.");
    } finally {
      disconnectLogs();
      setRunning(false);
    }
  };

  return (
    <div className="page fault-page">
      <PageHeader
        title="Uji fault tolerance"
        description="Simulasikan kegagalan salah satu worker dan amati penjadwalan ulang chunk secara dinamis."
      />

      <div className="fault-layout">
        <div className="fault-left">
          <section className="panel fault-form-panel">
            <div className="panel-heading">
              <div>
                <h2>Konfigurasi simulasi</h2>
                <p>Minimal 3 proses (1 master + 2 worker)</p>
              </div>
              <ShieldCheck size={17} strokeWidth={1.6} className="metric-compute" />
            </div>

            <label className="field-label">
              Ukuran matriks
              <select
                className="text-input mono"
                value={size}
                disabled={running}
                onChange={(event) => setSize(Number(event.target.value))}
              >
                <option value={4096}>4096 × 4096</option>
                <option value={2048}>2048 × 2048</option>
                <option value={1024}>1024 × 1024</option>
              </select>
            </label>

            <div className="fault-control-row">
              <label className="field-label">
                Jumlah proses
                <input
                  className="text-input mono"
                  type="number"
                  min={3}
                  max={16}
                  value={processes}
                  disabled={running}
                  onChange={(event) => {
                    const count = Math.max(3, Math.min(16, Number(event.target.value) || 3));
                    setProcesses(count);
                    setFailRank(Math.min(failRank, count - 1));
                  }}
                />
              </label>
              <label className="field-label">
                Rank gagal
                <select
                  className="text-input mono"
                  value={failRank}
                  disabled={running}
                  onChange={(event) => setFailRank(Number(event.target.value))}
                >
                  {Array.from({ length: processes - 1 }, (_, index) => index + 1).map((rank) => (
                    <option key={rank} value={rank}>
                      Rank {rank}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="fault-hint">
              <TriangleAlert size={14} strokeWidth={1.6} />
              <span>Master (Rank 0) tidak dapat dipilih sebagai node gagal.</span>
            </div>

            <RunButton onClick={run} busy={running} disabled={processes < 3}>
              {running ? "Simulasi berjalan..." : "Mulai simulasi"}
            </RunButton>

            {error && <div className="form-error">{error}. Coba jalankan ulang simulasi.</div>}
          </section>

          <section className="panel node-panel">
            <div className="panel-heading">
              <div>
                <h2>Status node</h2>
                <p>
                  {processes} proses · 1 master dan {processes - 1} worker
                </p>
              </div>
              <span className={`run-state mono ${running ? "running" : ""}`}>{running ? "Simulasi" : "Siap"}</span>
            </div>
            <NodeGrid count={processes} failedRank={failureTriggered ? failRank : undefined} />
          </section>

          <section className="panel task-panel">
            <div className="panel-heading">
              <div>
                <h2>Antrean chunk</h2>
                <p>Distribusi dinamis 8 blok baris matriks</p>
              </div>
              <span className="task-count mono">{Math.min(8, Math.round(progress / 12.5))} / 8</span>
            </div>
            <div className="task-progress-wrap">
              <ProgressBar value={progress} tone={result ? "compute" : "accent"} />
            </div>
            <div className="task-chunks">
              {Array.from({ length: 8 }, (_, index) => (
                <span key={index} className={index < progress / 12.5 ? "done" : ""}>
                  C{index + 1}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="fault-right">
          <section className="panel timeline-panel">
            <div className="panel-heading">
              <div>
                <h2>Timeline kejadian</h2>
                <p>Urutan deteksi kegagalan dan pemulihan task</p>
              </div>
            </div>
            {events.length ? (
              <EventTimeline events={events} />
            ) : (
              <div className="timeline-empty">Mulai simulasi untuk mencatat kronologi pemulihan.</div>
            )}
          </section>

          <section className="panel recovery-card">
            <div className="panel-heading">
              <div>
                <h2>Hasil pemulihan</h2>
                <p>Ringkasan integritas akhir matriks C</p>
              </div>
              {result && <CheckCircle2 size={17} strokeWidth={1.8} className="metric-compute" />}
            </div>

            {!result ? (
              <div className="recovery-placeholder">Belum ada hasil simulasi.</div>
            ) : (
              <div className="recovery-stats">
                <div className="recovery-status">
                  <span>Status pemulihan</span>
                  <strong className={result.recovered ? "metric-compute" : "metric-danger"}>
                    {result.recovered ? "Berhasil dipulihkan" : "Pemulihan gagal"}
                  </strong>
                </div>
                <div className="recovery-stat">
                  <small>Integritas matriks C</small>
                  <strong className={result.integrity ? "metric-compute" : "metric-danger"}>
                    {result.integrity ? "100% valid" : "Tidak valid"}
                  </strong>
                </div>
                <div className="recovery-stat">
                  <small>Waktu total + recovery</small>
                  <strong className="mono">{formatSeconds(result.duration)}</strong>
                </div>
                <div className="recovery-stat">
                  <small>Overhead pemulihan</small>
                  <strong className="metric-comm mono">{formatSeconds(result.recovery)}</strong>
                </div>
                <div className="recovery-stat">
                  <small>Node penyelesai</small>
                  <strong className="mono">
                    {result.completedBy.map((rank) => `Rank ${rank}`).join(", ") || "Master"}
                  </strong>
                </div>
              </div>
            )}
          </section>

          {savedLog && (
            <section className="terminal" aria-label="Log fault tolerance terakhir">
              <div className="terminal-bar">
                <span className="mono">results/fault_tolerance_log.txt</span>
                <span className="mono">ACTUAL MPI LOG</span>
              </div>
              <div className="terminal-content">
                {savedLog.split("\n").map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.includes("ALERT") || line.includes("CRASH")
                        ? "log-error"
                        : line.includes("SUKSES") || line.includes("IDENTIK")
                          ? "log-success"
                          : ""
                    }
                  >
                    {line}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="fault-footnote">
            <Info size={14} strokeWidth={1.6} />
            <span>
              {api.isLiveBackend()
                ? "Terhubung ke backend FastAPI — tombol simulasi mengeksekusi fault_tolerance_sim.py secara langsung."
                : <>Untuk eksekusi langsung di MPI, jalankan <code>mpiexec -n 4 python src/fault_tolerance_sim.py</code>.</>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
