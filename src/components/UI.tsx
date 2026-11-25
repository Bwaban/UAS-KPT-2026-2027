import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, CircleHelp, Clipboard, ClipboardCheck, Cpu, Download, Info, LoaderCircle,
  Play, TriangleAlert, X,
} from "lucide-react";
import type { BenchmarkRow, ExperimentParams, StageStatus } from "../types";
import { formatNumber, formatPercent, formatSeconds } from "../lib/utils";
import { processOptions } from "../data/mock";

export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string; title: string; description?: string; actions?: React.ReactNode;
}) {
  return <header className="page-header">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="header-actions">{actions}</div>}
  </header>;
}

export function KpiCard({ label, value, detail, icon: Icon, tone = "indigo" }: {
  label: string; value: string; detail: string; icon: React.ElementType; tone?: string;
}) {
  return <article className={`kpi-card tone-${tone}`}><div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={18} /></span></div><strong>{value}</strong><small>{detail}</small></article>;
}

export function ChartCard({ title, subtitle, children, className = "" }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return <section className={`panel chart-card ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>{children}</section>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><CircleHelp size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ThemeToggle({ theme, onToggle }: { theme: "dark" | "light"; onToggle: () => void }) {
  return <button className="theme-toggle" onClick={onToggle} aria-label={`Aktifkan tema ${theme === "dark" ? "terang" : "gelap"}`} title="Ganti tema">
    <span>{theme === "dark" ? "Gelap" : "Terang"}</span><span className={`toggle-track ${theme}`}><span /></span>
  </button>;
}

export function MetricTable({ rows, onRun }: { rows: BenchmarkRow[]; onRun?: (processes: number) => void }) {
  const [sortKey, setSortKey] = useState<keyof BenchmarkRow>("processes");
  const [ascending, setAscending] = useState(true);
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * (ascending ? 1 : -1);
    return 0;
  }), [ascending, rows, sortKey]);
  const head = (label: string, key: keyof BenchmarkRow) => <th><button className="sort-button" onClick={() => { setAscending(sortKey === key ? !ascending : true); setSortKey(key); }}>{label}{sortKey === key ? (ascending ? " ↑" : " ↓") : ""}</button></th>;
  return <div className="table-scroll"><table className="metric-table"><thead><tr>
    {head("Proses", "processes")}{head("Total", "t_total_s")}{head("T. komputasi", "t_comp_s")}{head("T. komunikasi", "t_comm_s")}{head("% komunikasi", "comm_percent")}{head("Speedup", "speedup")}{head("Efisiensi", "efficiency")}{head("GFLOPS", "throughput_gflops")}<th>Status</th>
  </tr></thead><tbody>{sorted.map((row) => {
    const executed = row.executed !== false;
    return <tr key={`${row.matrix_size}-${row.processes}`} className={executed ? "" : "row-muted"}>
      <td><span className="process-pill">P={row.processes}</span></td><td className="mono">{formatSeconds(row.t_total_s)}</td><td className="metric-compute mono">{formatSeconds(row.t_comp_s)}</td><td className="metric-comm mono">{formatSeconds(row.t_comm_s)}</td>
      <td><span className={`comm-badge ${row.comm_percent < 15 ? "low" : row.comm_percent <= 30 ? "medium" : "high"}`}>{formatPercent(row.comm_percent)}</span></td>
      <td className="metric-indigo">{formatNumber(row.speedup, 2)}×</td><td>{formatPercent(row.efficiency * 100)}</td><td>{formatNumber(row.throughput_gflops, 1)}</td>
      <td>{executed ? <span className="status-label"><Check size={13} /> Selesai</span> : <button className="text-button" onClick={() => onRun?.(row.processes)}><Play size={13} /> Jalankan</button>}</td>
    </tr>;
  })}</tbody></table></div>;
}

export function ParamForm({ value, onChange, disabled = false }: {
  value: ExperimentParams; onChange: (value: ExperimentParams) => void; disabled?: boolean;
}) {
  const change = (patch: Partial<ExperimentParams>) => onChange({ ...value, ...patch });
  return <fieldset className="param-form" disabled={disabled}>
    <label className="field-label">Mode eksperimen</label><div className="segmented">
      <button type="button" className={value.mode === "single" ? "selected" : ""} onClick={() => change({ mode: "single" })}>Uji tunggal</button>
      <button type="button" className={value.mode === "benchmark" ? "selected" : ""} onClick={() => change({ mode: "benchmark" })}>Benchmark scaling</button>
    </div>
    <label className="field-label" htmlFor="matrix-size">Ukuran matriks</label>
    <div className="size-options">{[4096, 2048, 1024].map((size) => <button type="button" key={size} className={value.size === size ? "size-chip selected" : "size-chip"} onClick={() => change({ size })}>{size.toLocaleString("id-ID")}</button>)}
      <label className={`size-chip custom-chip ${![4096, 2048, 1024].includes(value.size) ? "selected" : ""}`}><span>Kustom</span><input id="matrix-size" aria-label="Ukuran matriks kustom" type="number" min="1" value={![4096, 2048, 1024].includes(value.size) ? value.size : ""} placeholder="N" onChange={(event) => change({ size: Math.max(1, Number(event.target.value) || 1) })} /></label>
    </div>
    <label className="field-label">Jumlah proses</label><div className="process-options">{processOptions.map((process) => <button type="button" key={process} className={`process-chip ${value.processes.includes(process) ? "selected" : ""}`} onClick={() => {
      const next = value.processes.includes(process) ? value.processes.filter((item) => item !== process) : [...value.processes, process].sort((a, b) => a - b);
      change({ processes: next.length ? next : [1] });
    }}>P={process}</button>)}</div>
    <div className="field-grid">
      <label className="field-label">Seed<input className="text-input" type="number" value={value.seed} onChange={(event) => change({ seed: Number(event.target.value) })} /></label>
      <label className="field-label">Path CSV<input className="text-input mono" value={value.csvPath} onChange={(event) => change({ csvPath: event.target.value })} /></label>
    </div>
    <div className="switch-list">
      <label className="switch-row"><span><strong>--verify</strong><small>Validasi hasil terhadap perkalian sekuensial</small></span><input type="checkbox" checked={value.verify} onChange={(event) => change({ verify: event.target.checked })} /><i /></label>
      <label className="switch-row"><span><strong>--save</strong><small>Simpan matriks C sebagai berkas .npy</small></span><input type="checkbox" checked={value.save} onChange={(event) => change({ save: event.target.checked })} /><i /></label>
    </div>
  </fieldset>;
}

export function CommandPreview({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return <div className="command-box"><div className="command-top"><span><span className="live-dot" /> Pratinjau perintah</span><button aria-label="Salin perintah" className="icon-button" onClick={copy}>{copied ? <ClipboardCheck size={15} /> : <Clipboard size={15} />}{copied ? " Tersalin" : " Salin"}</button></div><code>{command}</code></div>;
}

const stages = ["Generate A, B", "Bcast B", "Scatterv A", "Matmul", "Gatherv C", "Verifikasi"];
export function StageStepper({ current, error = false }: { current: number; error?: boolean }) {
  return <ol className="stage-stepper">{stages.map((stage, index) => {
    const status: StageStatus = error && index === current ? "error" : index < current ? "complete" : index === current ? "active" : "waiting";
    return <li className={`stage ${status}`} key={stage}><span className="stage-marker">{status === "complete" ? <Check size={13} /> : status === "error" ? <X size={13} /> : index + 1}</span><span>{stage}</span></li>;
  })}</ol>;
}

export function LogTerminal({ lines, running }: { lines: string[]; running?: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [lines]);
  return <section className="terminal" aria-label="Log eksperimen"><div className="terminal-bar"><div><i /><i /><i /></div><span>mpi://rank-0 — log langsung</span><span>{running ? <><span className="live-dot" /> BERJALAN</> : "SIAP"}</span></div>
    <div ref={contentRef} className="terminal-content" role="log" aria-live="polite">{lines.length ? lines.map((line, index) => <div className={line.includes("[galat]") ? "log-error" : line.includes("[✓]") ? "log-success" : ""} key={`${index}-${line}`}>{line}</div>) : <div className="terminal-empty">Log eksekusi akan tampil di sini.</div>}{running && <span className="cursor" />}</div>
  </section>;
}

export function InsightCard({ process = 4, comm = 24.52, efficiency = 65.3 }: { process?: number; comm?: number; efficiency?: number }) {
  const saturated = comm > 25 && efficiency < 70;
  const efficiencyFalling = efficiency < 70;
  const title = saturated ? "Titik jenuh terdeteksi" : efficiencyFalling ? "Efisiensi mulai menurun" : "Skalabilitas masih sehat";
  const description = saturated
    ? `Pada P=${process}, komunikasi mencapai ${formatPercent(comm)} sementara efisiensi turun ke ${formatPercent(efficiency)}. Menurut Amdahl’s Law, bagian serial dan overhead komunikasi membatasi speedup ketika proses ditambah.`
    : efficiencyFalling
      ? `Pada P=${process}, efisiensi ${formatPercent(efficiency)} sudah menurun, tetapi komunikasi ${formatPercent(comm)} belum melewati ambang 25%. Pantau konfigurasi proses berikutnya untuk mengonfirmasi titik jenuh menurut Amdahl’s Law.`
      : "Penambahan proses masih memberi peningkatan performa. Pantau rasio komunikasi pada konfigurasi berikutnya.";
  return <aside className={`insight-card ${saturated || efficiencyFalling ? "warning" : ""}`}><div className="insight-icon">{saturated || efficiencyFalling ? <Info size={18} /> : <Cpu size={18} />}</div><div><div className="insight-title">{title}</div><p>{description}</p></div></aside>;
}

export function NodeGrid({ count, failedRank, active = true }: { count: number; failedRank?: number; active?: boolean }) {
  return <div className="node-grid">{Array.from({ length: count }, (_, rank) => {
    const failed = rank === failedRank;
    return <div key={rank} className={`node ${rank === 0 ? "master-node" : failed ? "failed-node" : active ? "worker-node" : "idle-node"}`}><div className="node-icon">{failed ? <TriangleAlert size={18} /> : <Cpu size={18} />}</div><strong>{rank === 0 ? "Master" : `Worker ${rank}`}</strong><small>Rank {rank} · {rank === 0 ? "Koordinator" : failed ? "Gagal" : active ? "Aktif" : "Siaga"}</small></div>;
  })}</div>;
}

export interface TimelineEvent { label: string; time: string; tone?: "danger" | "success" | "normal"; detail?: string }
export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return <ol className="event-timeline">{events.map((event, index) => <li className={`event-item ${event.tone ?? "normal"}`} key={`${event.label}-${index}`}><span className="event-marker" /><div><strong>{event.label}</strong>{event.detail && <small>{event.detail}</small>}<time>{event.time}</time></div></li>)}</ol>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-list" aria-label="Memuat data">{Array.from({ length: rows }, (_, index) => <div className="skeleton-row" key={index}><span /><span /><span /></div>)}</div>;
}

export function ProgressBar({ value, tone = "indigo" }: { value: number; tone?: string }) {
  return <div className={`progress-track progress-${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

export function RunButton({ children, onClick, disabled, busy = false, secondary = false }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean;
}) {
  return <button className={secondary ? "button-secondary" : "button-primary"} disabled={disabled || busy} onClick={onClick}>{busy ? <LoaderCircle className="spin" size={16} /> : <Play size={15} />}{children}</button>;
}

export function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="button-secondary" onClick={onClick}><Download size={15} />{label}</button>;
}

export function FormError({ message }: { message: string }) {
  return <div className="form-error" role="alert"><TriangleAlert size={17} />{message}</div>;
}
