import { useState } from "react";
import { CheckCircle2, ShieldCheck, TriangleAlert, Waves } from "lucide-react";
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
  const [result, setResult] = useState<{ recovered: boolean; integrity: boolean; duration: number; recovery: number; completedBy: number[] } | null>(null);
  const [error, setError] = useState("");
  const addEvent = (label: string, tone: "danger" | "success" | "normal", detail: string) => setEvents((current) => [...current, { label, tone, detail, time: new Date().toLocaleTimeString("id-ID", { hour12: false }) }]);
  const run = async () => {
    setRunning(true); setProgress(0); setResult(null); setError(""); setEvents([]); setFailureTriggered(false);
    addEvent("Task dikirim ke worker", "normal", "8 chunk pekerjaan masuk ke antrean");
    try {
      for (let percent = 12; percent <= 96; percent += 12) {
        await new Promise((resolve) => window.setTimeout(resolve, 270));
        if (percent === 36) { setFailureTriggered(true); addEvent(`Crash terdeteksi pada Rank ${failRank}`, "danger", "Worker tidak merespons · proses diisolasi"); }
        if (percent === 48) addEvent("Task ditarik kembali", "normal", "Chunk yang belum selesai dikembalikan ke master");
        if (percent === 60) addEvent("Task dijadwalkan ulang", "normal", "Pekerjaan dialihkan ke worker aktif");
        setProgress(percent);
      }
      const output = await api.fault({ size, processes, failRank });
      setProgress(100);
      setResult(output);
      addEvent("Semua task selesai", "success", "Matriks C berhasil direkonstruksi dan diverifikasi");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Simulasi gagal. Periksa konfigurasi lalu coba lagi."); }
    finally { setRunning(false); }
  };
  return <div className="page fault-page">
    <PageHeader eyebrow="KETAHANAN SISTEM" title="Uji fault tolerance" description="Simulasikan kegagalan worker dan amati penjadwalan ulang task secara dinamis." />
    <div className="fault-layout">
      <div className="fault-left">
        <section className="panel fault-form-panel"><div className="panel-heading"><div><h2>Konfigurasi simulasi</h2><p>Jumlah proses minimal 3 (master + 2 worker)</p></div><ShieldCheck size={19} className="metric-compute" /></div>
          <label className="field-label">Ukuran matriks<select className="text-input" value={size} disabled={running} onChange={(event) => setSize(Number(event.target.value))}><option value={4096}>4096 × 4096</option><option value={2048}>2048 × 2048</option><option value={1024}>1024 × 1024</option></select></label>
          <div className="fault-control-row"><label className="field-label">Jumlah proses<input className="text-input" type="number" min={3} max={16} value={processes} disabled={running} onChange={(event) => { const count = Math.max(3, Math.min(16, Number(event.target.value) || 3)); setProcesses(count); setFailRank(Math.min(failRank, count - 1)); }} /></label>
            <label className="field-label">Rank gagal<select className="text-input" value={failRank} disabled={running} onChange={(event) => setFailRank(Number(event.target.value))}>{Array.from({ length: processes - 1 }, (_, index) => index + 1).map((rank) => <option key={rank} value={rank}>Rank {rank}</option>)}</select></label></div>
          <div className="fault-hint"><TriangleAlert size={15} /> Master (Rank 0) tidak dapat dipilih sebagai node gagal.</div>
          <RunButton onClick={run} busy={running} disabled={processes < 3}>{running ? "Simulasi berjalan" : "Mulai simulasi"}</RunButton>
          {error && <div className="form-error">{error}. Coba jalankan ulang simulasi.</div>}
        </section>
        <section className="panel node-panel">        <div className="panel-heading"><div><h2>Status node</h2><p>{processes} proses · satu master dan {processes - 1} worker</p></div><span className="live-state">{running ? "● Simulasi" : "● Siap"}</span></div><NodeGrid count={processes} failedRank={failureTriggered ? failRank : undefined} /></section>
        <section className="panel task-panel"><div className="panel-heading"><div><h2>Antrean task</h2><p>Progres pemrosesan 8 chunk matriks</p></div><span className="task-count">{Math.round(progress / 12)} / 8</span></div>
          <ProgressBar value={progress} tone={result ? "teal" : "indigo"} /><div className="task-chunks">{Array.from({ length: 8 }, (_, index) => <span key={index} className={index < progress / 12 ? "done" : ""}>C{index + 1}</span>)}</div>
        </section>
      </div>
      <div className="fault-right">
        <section className="panel timeline-panel"><div className="panel-heading"><div><h2>Timeline kejadian</h2><p>Urutan pemulihan node dan task</p></div><Waves size={18} className="muted-icon" /></div>
          {events.length ? <EventTimeline events={events} /> : <div className="timeline-empty">Kejadian simulasi akan tercatat di sini.</div>}
        </section>
        <section className="panel recovery-card"><div className="panel-heading"><div><h2>Hasil pemulihan</h2><p>Ringkasan integritas komputasi</p></div>{result && <CheckCircle2 size={19} className="metric-compute" />}</div>
          {!result ? <div className="recovery-placeholder">Jalankan simulasi untuk melihat hasil pemulihan worker.</div> : <div className="recovery-stats">
            <div className="recovery-status"><span>Status pemulihan</span><strong className={result.recovered ? "metric-compute" : "metric-danger"}>{result.recovered ? "Berhasil dipulihkan" : "Pemulihan gagal"}</strong></div>
            <div className="recovery-stat"><small>Integritas matriks C</small><strong className={result.integrity ? "metric-compute" : "metric-danger"}>{result.integrity ? "100% valid" : "Tidak valid"}</strong></div>
            <div className="recovery-stat"><small>Waktu total + recovery</small><strong>{formatSeconds(result.duration)}</strong></div>
            <div className="recovery-stat"><small>Waktu pemulihan</small><strong className="metric-comm">{formatSeconds(result.recovery)}</strong></div>
            <div className="recovery-stat"><small>Node penyelesai</small><strong>{result.completedBy.map((rank) => `Rank ${rank}`).join(", ") || "Master"}</strong></div>
          </div>}
        </section>
        <div className="fault-footnote"><TriangleAlert size={15} /> Ini adalah simulasi antarmuka. Integrasi backend dapat menjalankan <code>fault_tolerance_sim.py</code>.</div>
      </div>
    </div>
  </div>;
}
