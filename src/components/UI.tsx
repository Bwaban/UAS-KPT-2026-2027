import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleHelp,
  Clipboard,
  ClipboardCheck,
  Cpu,
  Download,
  Info,
  LoaderCircle,
  Moon,
  Play,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import type { BenchmarkRow, ExperimentParams, StageStatus } from "../types";
import { formatNumber, formatPercent, formatSeconds } from "../lib/utils";
import { processOptions } from "../data/mock";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <div className="page-meta mono">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}

export function KpiCard({
  label,
  value,
  detail,
  tone = "accent",
}: {
  label: string;
  value: string;
  detail: string;
  icon?: React.ElementType;
  tone?: string;
}) {
  return (
    <article className={`kpi-cell tone-${tone}`}>
      <div className="kpi-label">
        <span className="kpi-dot" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <strong className="kpi-value mono">{value}</strong>
      <small className="kpi-detail">{detail}</small>
    </article>
  );
}

export function ChartCard({
  title,
  subtitle,
  meta,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel chart-card ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <CircleHelp size={18} strokeWidth={1.6} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "dark" | "light";
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={`Ganti ke tema ${theme === "dark" ? "terang" : "gelap"}`}
      title={`Ganti ke tema ${theme === "dark" ? "terang" : "gelap"}`}
    >
      {theme === "dark" ? <Sun size={15} strokeWidth={1.6} /> : <Moon size={15} strokeWidth={1.6} />}
    </button>
  );
}

export function MetricTable({
  rows,
  onRun,
}: {
  rows: BenchmarkRow[];
  onRun?: (processes: number) => void;
}) {
  const [sortKey, setSortKey] = useState<keyof BenchmarkRow>("processes");
  const [ascending, setAscending] = useState(true);
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * (ascending ? 1 : -1);
        return 0;
      }),
    [ascending, rows, sortKey],
  );

  const head = (label: string, key: keyof BenchmarkRow) => (
    <th>
      <button
        type="button"
        className="sort-button"
        onClick={() => {
          setAscending(sortKey === key ? !ascending : true);
          setSortKey(key);
        }}
      >
        {label}
        {sortKey === key ? (ascending ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="table-scroll">
      <table className="metric-table">
        <thead>
          <tr>
            {head("Proses", "processes")}
            {head("Total", "t_total_s")}
            {head("Komputasi", "t_comp_s")}
            {head("Komunikasi", "t_comm_s")}
            {head("Rasio comm", "comm_percent")}
            {head("Speedup", "speedup")}
            {head("Efisiensi", "efficiency")}
            {head("GFLOPS", "throughput_gflops")}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const executed = row.executed !== false;
            return (
              <tr key={`${row.matrix_size}-${row.processes}`} className={executed ? "" : "row-muted"}>
                <td>
                  <span className="process-pill mono">P={row.processes}</span>
                </td>
                <td className="mono">{executed ? formatSeconds(row.t_total_s) : "—"}</td>
                <td className="metric-compute mono">{executed ? formatSeconds(row.t_comp_s) : "—"}</td>
                <td className="metric-comm mono">{executed ? formatSeconds(row.t_comm_s) : "—"}</td>
                <td>
                  {executed ? (
                    <span
                      className={`comm-badge mono ${
                        row.comm_percent < 15 ? "low" : row.comm_percent <= 30 ? "medium" : "high"
                      }`}
                    >
                      {formatPercent(row.comm_percent)}
                    </span>
                  ) : (
                    <span className="muted-cell mono">—</span>
                  )}
                </td>
                <td className="mono strong-cell">{executed ? `${formatNumber(row.speedup, 2)}×` : "—"}</td>
                <td className="mono">{executed ? formatPercent(row.efficiency * 100) : "—"}</td>
                <td className="mono">{executed ? formatNumber(row.throughput_gflops, 1) : "—"}</td>
                <td>
                  {executed ? (
                    <span className="status-label">
                      <Check size={13} strokeWidth={1.8} /> Selesai
                    </span>
                  ) : (
                    <button type="button" className="text-button" onClick={() => onRun?.(row.processes)}>
                      <Play size={12} strokeWidth={1.8} /> Jalankan
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ParamForm({
  value,
  onChange,
  disabled = false,
}: {
  value: ExperimentParams;
  onChange: (value: ExperimentParams) => void;
  disabled?: boolean;
}) {
  const change = (patch: Partial<ExperimentParams>) => onChange({ ...value, ...patch });
  return (
    <fieldset className="param-form" disabled={disabled}>
      <div className="field-block">
        <label className="field-label">Mode eksperimen</label>
        <div className="segmented segmented-4">
          <button
            type="button"
            className={value.mode === "single" ? "selected" : ""}
            onClick={() => change({ mode: "single" })}
          >
            Pure MPI
          </button>
          <button
            type="button"
            className={value.mode === "benchmark" ? "selected" : ""}
            onClick={() => change({ mode: "benchmark", processes: [1, 2, 4, 8, 16] })}
          >
            Scaling
          </button>
          <button
            type="button"
            className={value.mode === "hybrid" ? "selected" : ""}
            onClick={() => change({ mode: "hybrid", processes: [2], threads: value.threads ?? 4 })}
          >
            Hybrid OMP
          </button>
          <button
            type="button"
            className={value.mode === "latency" ? "selected" : ""}
            onClick={() => change({ mode: "latency", processes: [2], trials: value.trials ?? 20 })}
          >
            Latency
          </button>
        </div>
      </div>

      {value.mode !== "latency" && (
        <div className="field-block">
          <label className="field-label" htmlFor="matrix-size">
            Ukuran matriks (N × N)
          </label>
          <div className="size-options">
            {[4096, 2048, 1024].map((size) => (
              <button
                type="button"
                key={size}
                className={`size-chip mono ${value.size === size ? "selected" : ""}`}
                onClick={() => change({ size })}
              >
                {size.toLocaleString("id-ID")}
              </button>
            ))}
            <label className={`size-chip custom-chip ${![4096, 2048, 1024].includes(value.size) ? "selected" : ""}`}>
              <span>Kustom</span>
              <input
                id="matrix-size"
                aria-label="Ukuran matriks kustom"
                className="mono"
                type="number"
                min="1"
                value={![4096, 2048, 1024].includes(value.size) ? value.size : ""}
                placeholder="N"
                onChange={(event) => change({ size: Math.max(1, Number(event.target.value) || 1) })}
              />
            </label>
          </div>
        </div>
      )}

      {value.mode !== "latency" && (
        <div className="field-block">
          <label className="field-label">
            {value.mode === "benchmark" ? "Variasi jumlah proses MPI" : "Jumlah proses MPI"}
          </label>
          <div className="process-options">
            {processOptions.map((process) => (
              <button
                type="button"
                key={process}
                className={`process-chip mono ${value.processes.includes(process) ? "selected" : ""}`}
                onClick={() => {
                  if (value.mode === "benchmark") {
                    const next = value.processes.includes(process)
                      ? value.processes.filter((item) => item !== process)
                      : [...value.processes, process].sort((a, b) => a - b);
                    change({ processes: next.length ? next : [1] });
                  } else {
                    change({ processes: [process] });
                  }
                }}
              >
                P={process}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.mode === "hybrid" && (
        <div className="field-block">
          <label className="field-label">Thread OpenMP per proses MPI</label>
          <div className="process-options">
            {[1, 2, 4, 8].map((t) => (
              <button
                type="button"
                key={t}
                className={`process-chip mono ${(value.threads ?? 2) === t ? "selected" : ""}`}
                onClick={() => change({ threads: t })}
              >
                T={t} ({(value.processes[0] ?? 2) * t} core)
              </button>
            ))}
          </div>
        </div>
      )}

      {value.mode === "latency" && (
        <div className="field-block">
          <label className="field-label">Jumlah pengulangan Ping-Pong per ukuran paket (4 B – 64 MB)</label>
          <div className="process-options">
            {[10, 20, 50].map((trials) => (
              <button
                type="button"
                key={trials}
                className={`process-chip mono ${(value.trials ?? 20) === trials ? "selected" : ""}`}
                onClick={() => change({ trials })}
              >
                {trials} trials
              </button>
            ))}
          </div>
        </div>
      )}

      {value.mode === "single" && (
        <div className="field-grid">
          <label className="field-label">
            Seed
            <input
              className="text-input mono"
              type="number"
              value={value.seed}
              onChange={(event) => change({ seed: Number(event.target.value) })}
            />
          </label>
          <label className="field-label">
            Output CSV
            <input
              className="text-input mono"
              value={value.csvPath}
              onChange={(event) => change({ csvPath: event.target.value })}
            />
          </label>
        </div>
      )}

      {value.mode === "single" && (
        <div className="switch-list">
          <label className="switch-row">
            <span>
              <strong>--verify</strong>
              <small>Validasi hasil terhadap perkalian sekuensial NumPy</small>
            </span>
            <input
              type="checkbox"
              checked={value.verify}
              onChange={(event) => change({ verify: event.target.checked })}
            />
            <i />
          </label>
          <label className="switch-row">
            <span>
              <strong>--save</strong>
              <small>Simpan matriks hasil C sebagai berkas .npy</small>
            </span>
            <input
              type="checkbox"
              checked={value.save}
              onChange={(event) => change({ save: event.target.checked })}
            />
            <i />
          </label>
        </div>
      )}

      {value.mode === "benchmark" && (
        <div className="switch-list">
          <label className="switch-row">
            <span>
              <strong>Weak scaling (Gustafson)</strong>
              <small>Jalankan uji weak scaling (N ∝ P^1/3) setelah strong scaling selesai</small>
            </span>
            <input
              type="checkbox"
              checked={value.weakScaling ?? true}
              onChange={(event) => change({ weakScaling: event.target.checked })}
            />
            <i />
          </label>
        </div>
      )}
    </fieldset>
  );
}

export function CommandPreview({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="command-box">
      <div className="command-top">
        <span className="mono">
          <span className="live-dot" /> Perintah CLI
        </span>
        <button type="button" aria-label="Salin perintah" className="icon-button" onClick={copy}>
          {copied ? <ClipboardCheck size={14} strokeWidth={1.6} /> : <Clipboard size={14} strokeWidth={1.6} />}
          <span>{copied ? "Tersalin" : "Salin"}</span>
        </button>
      </div>
      <code>{command}</code>
    </div>
  );
}

const stages = ["Generate A, B", "Bcast B", "Scatterv A", "Matmul", "Gatherv C", "Verifikasi"];
export function StageStepper({ current, error = false }: { current: number; error?: boolean }) {
  return (
    <ol className="stage-stepper">
      {stages.map((stage, index) => {
        const status: StageStatus =
          error && index === current
            ? "error"
            : index < current
              ? "complete"
              : index === current
                ? "active"
                : "waiting";
        return (
          <li className={`stage ${status}`} key={stage}>
            <span className="stage-marker mono">
              {status === "complete" ? (
                <Check size={12} strokeWidth={2} />
              ) : status === "error" ? (
                <X size={12} strokeWidth={2} />
              ) : (
                index + 1
              )}
            </span>
            <span>{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function LogTerminal({ lines, running }: { lines: string[]; running?: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [lines]);
  return (
    <section className="terminal" aria-label="Log eksperimen">
      <div className="terminal-bar">
        <span className="mono">stdout · mpi://rank-0</span>
        <span className={`terminal-state mono ${running ? "active" : ""}`}>
          {running ? (
            <>
              <span className="live-dot" /> BERJALAN
            </>
          ) : (
            "SIAP"
          )}
        </span>
      </div>
      <div ref={contentRef} className="terminal-content" role="log" aria-live="polite">
        {lines.length ? (
          lines.map((line, index) => (
            <div
              className={line.includes("[galat]") ? "log-error" : line.includes("[✓]") ? "log-success" : ""}
              key={`${index}-${line}`}
            >
              {line}
            </div>
          ))
        ) : (
          <div className="terminal-empty">Belum ada output. Jalankan eksperimen untuk memantau log MPI.</div>
        )}
        {running && <span className="cursor" />}
      </div>
    </section>
  );
}

export function InsightCard({
  process = 4,
  comm = 24.52,
  efficiency = 65.3,
}: {
  process?: number;
  comm?: number;
  efficiency?: number;
}) {
  const saturated = comm > 25 && efficiency < 70;
  const efficiencyFalling = efficiency < 70;
  const title = saturated
    ? "Titik jenuh komunikasi terdeteksi"
    : efficiencyFalling
      ? "Efisiensi mulai menurun"
      : "Skalabilitas dalam batas sehat";
  const description = saturated
    ? `Pada P=${process}, porsi komunikasi mencapai ${formatPercent(comm)} sementara efisiensi turun ke ${formatPercent(efficiency)}. Sesuai Amdahl’s Law, bagian serial dan biaya transfer MPI mulai membatasi speedup.`
    : efficiencyFalling
      ? `Pada P=${process}, efisiensi berada di ${formatPercent(efficiency)} dengan rasio komunikasi ${formatPercent(comm)}. Pantau konfigurasi proses lebih tinggi untuk memetakan titik jenuh.`
      : "Penambahan proses masih memberikan akselerasi yang proporsional terhadap beban komputasi.";

  return (
    <aside className={`insight-card ${saturated || efficiencyFalling ? "warning" : ""}`}>
      <div className="insight-icon">
        {saturated || efficiencyFalling ? <Info size={16} strokeWidth={1.6} /> : <Cpu size={16} strokeWidth={1.6} />}
      </div>
      <div>
        <div className="insight-title">{title}</div>
        <p>{description}</p>
      </div>
    </aside>
  );
}

export function NodeGrid({
  count,
  failedRank,
  active = true,
}: {
  count: number;
  failedRank?: number;
  active?: boolean;
}) {
  return (
    <div className="node-grid">
      {Array.from({ length: count }, (_, rank) => {
        const failed = rank === failedRank;
        return (
          <div
            key={rank}
            className={`node ${
              rank === 0 ? "master-node" : failed ? "failed-node" : active ? "worker-node" : "idle-node"
            }`}
          >
            <div className="node-top">
              <strong>{rank === 0 ? "Master" : `Worker ${rank}`}</strong>
              <span className="node-rank mono">R{rank}</span>
            </div>
            <div className="node-status">
              <span className="node-dot" aria-hidden="true" />
              <small>{rank === 0 ? "Koordinator" : failed ? "Gagal (diisolasi)" : active ? "Aktif" : "Siaga"}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export interface TimelineEvent {
  label: string;
  time: string;
  tone?: "danger" | "success" | "normal";
  detail?: string;
}

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="event-timeline">
      {events.map((event, index) => (
        <li className={`event-item ${event.tone ?? "normal"}`} key={`${event.label}-${index}`}>
          <span className="event-marker" />
          <div>
            <strong>{event.label}</strong>
            <time className="mono">{event.time}</time>
            {event.detail && <small>{event.detail}</small>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-list" aria-label="Memuat data">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone = "accent" }: { value: number; tone?: string }) {
  return (
    <div
      className={`progress-track progress-${tone}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function RunButton({
  children,
  onClick,
  disabled,
  busy = false,
  secondary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      className={secondary ? "button-secondary" : "button-primary"}
      disabled={disabled || busy}
      onClick={onClick}
    >
      {busy ? <LoaderCircle className="spin" size={15} strokeWidth={1.8} /> : <Play size={14} strokeWidth={1.8} />}
      <span>{children}</span>
    </button>
  );
}

export function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="button-secondary" onClick={onClick}>
      <Download size={14} strokeWidth={1.6} />
      <span>{label}</span>
    </button>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <div className="form-error" role="alert">
      <TriangleAlert size={16} strokeWidth={1.6} />
      <span>{message}</span>
    </div>
  );
}
