import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FileImage, FileSpreadsheet, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { chartColors, processOptions } from "../data/mock";
import type { BenchmarkRow, ExtraMetrics } from "../types";
import { formatNumber, formatPercent, formatSeconds } from "../lib/utils";
import {
  ChartCard,
  EmptyState,
  ExportButton,
  InsightCard,
  MetricTable,
  PageHeader,
  Skeleton,
} from "../components/UI";

type ChartTab = "time" | "speedup" | "efficiency" | "bottleneck" | "weak" | "latency" | "hybrid";
const tabs: { id: ChartTab; label: string }[] = [
  { id: "time", label: "Waktu vs core" },
  { id: "speedup", label: "Speedup" },
  { id: "efficiency", label: "Efisiensi" },
  { id: "bottleneck", label: "Bottleneck" },
  { id: "weak", label: "Weak scaling" },
  { id: "latency", label: "Latency" },
  { id: "hybrid", label: "Hybrid MPI+OMP" },
];

export default function Results() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BenchmarkRow[] | null>(null);
  const [extra, setExtra] = useState<ExtraMetrics | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ChartTab>("time");
  const [matrixSize, setMatrixSize] = useState(4096);
  const [source, setSource] = useState("results/benchmark_summary.csv");
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getResults(source)
      .then((data) => {
        setRows(data);
        if (data.length && !data.some((r) => r.matrix_size === matrixSize)) {
          setMatrixSize(Math.max(...data.map((r) => r.matrix_size)));
        }
      })
      .catch((reason: Error) => {
        setError(reason.message);
        setRows([]);
      });
    api.getExtra().then(setExtra).catch(() => {});
  }, [source]);

  const filtered = useMemo(() => (rows ?? []).filter((row) => row.matrix_size === matrixSize), [matrixSize, rows]);
  const displayedRows = useMemo(
    () =>
      processOptions.map(
        (processes) =>
          filtered.find((row) => row.processes === processes) ?? {
            matrix_size: matrixSize,
            processes,
            t_total_s: 0,
            t_comp_s: 0,
            t_comm_s: 0,
            t_comm_in_s: 0,
            t_comm_out_s: 0,
            comp_percent: 0,
            comm_percent: 0,
            speedup: 0,
            efficiency: 0,
            throughput_gflops: 0,
            executed: false,
          },
      ),
    [filtered, matrixSize],
  );

  const chartData = filtered.map((row) => ({ proses: `P=${row.processes}`, ...row, ideal: row.processes }));
  const weakData = (extra?.weak_scaling ?? []).map((row) => ({
    label: `P=${row.processes} (${row.matrix_size})`,
    ...row,
    ideal: row.processes,
  }));
  const latencyData = extra?.latency ?? [];
  const hybridData = (extra?.hybrid ?? []).map((row) => ({
    config: `${row.mpi_procs} MPI × ${row.omp_threads} OMP`,
    ...row,
  }));

  const commBottleneck = filtered.find((row) => row.comm_percent > 25 && row.efficiency < 0.7);
  const latestFiltered = filtered[filtered.length - 1];

  const downloadCsv = () => {
    const header =
      "matrix_size,processes,t_total_s,t_comp_s,t_comm_s,t_comm_in_s,t_comm_out_s,comp_percent,comm_percent,speedup,efficiency,throughput_gflops";
    const content = [
      header,
      ...filtered.map((row) =>
        [
          row.matrix_size,
          row.processes,
          row.t_total_s,
          row.t_comp_s,
          row.t_comm_s,
          row.t_comm_in_s,
          row.t_comm_out_s,
          row.comp_percent,
          row.comm_percent,
          row.speedup,
          row.efficiency,
          row.throughput_gflops,
        ].join(","),
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = `benchmark_${matrixSize}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadPng = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 650;
    const context = canvas.getContext("2d");
    if (!context) return;
    const background = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#111113";
    const ink = getComputedStyle(document.documentElement).getPropertyValue("--text-main").trim() || "#FAFAFA";
    const muted = getComputedStyle(document.documentElement).getPropertyValue("--text-muted").trim() || "#71717A";
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = ink;
    context.font = "600 24px Geist, sans-serif";
    context.fillText(tabs.find((item) => item.id === tab)?.label ?? "Hasil benchmark", 48, 48);
    if (filtered.length) {
      const key = tab === "speedup" ? "speedup" : tab === "efficiency" ? "efficiency" : "t_total_s";
      const max = Math.max(...filtered.map((row) => row[key]), 1) * 1.15;
      const points = filtered.map((row, index) => ({
        x: 90 + index * (1020 / Math.max(1, filtered.length - 1)),
        y: 540 - (row[key] / max) * 400,
      }));
      context.strokeStyle = tab === "efficiency" ? chartColors.compute : chartColors.total;
      context.lineWidth = 3;
      context.beginPath();
      points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
      context.stroke();
      points.forEach((point, index) => {
        context.fillStyle = chartColors.total;
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = muted;
        context.font = "15px Geist Mono, monospace";
        context.fillText(`P=${filtered[index].processes}`, point.x - 16, 580);
      });
    } else {
      context.fillStyle = muted;
      context.font = "18px Geist, sans-serif";
      context.fillText("Belum ada data untuk ditampilkan.", 48, 120);
    }
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `grafik_${tab}_${matrixSize}.png`;
    link.click();
  };

  const tooltipStyle = {
    background: "var(--surface-raised)",
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    color: "var(--text-main)",
    fontSize: 12,
    fontFamily: "Geist Mono, monospace",
  };
  const tick = { fill: "var(--text-muted)", fontSize: 11, fontFamily: "Geist Mono, monospace" };

  const chartContent = () => {
    if (tab === "weak") {
      if (!weakData.length)
        return <EmptyState title="Data weak scaling belum tersedia" description="Jalankan benchmark_runner.py untuk merekam data weak scaling." />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={weakData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={tick} />
            <YAxis tick={tick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatNumber(value, 3), name]} />
            <Line dataKey="t_total_s" name="Waktu total (dtk)" stroke={chartColors.total} strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.total }} />
            <Line dataKey="gustafson_speedup" name="Gustafson speedup" stroke={chartColors.compute} strokeWidth={2} dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.compute }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (tab === "latency") {
      if (!latencyData.length)
        return <EmptyState title="Data latency belum tersedia" description="Jalankan mpiexec -n 2 python src/latency_benchmark.py." />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={latencyData} margin={{ top: 12, right: 12, left: -4, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="size_label" tickLine={false} axisLine={false} tick={tick} />
            <YAxis yAxisId="bw" tick={tick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="lat" orientation="right" tick={tick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatNumber(value, 3), name]} />
            <Bar yAxisId="bw" dataKey="bandwidth_mbps" name="Bandwidth (MB/s)" fill={chartColors.total} radius={[4, 4, 0, 0]} />
            <Line yAxisId="lat" dataKey="latency_ms" name="Latency (ms)" stroke={chartColors.communication} strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.communication }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    if (tab === "hybrid") {
      if (!hybridData.length)
        return <EmptyState title="Data hybrid belum tersedia" description="Jalankan src/matrix_mul_hybrid.py untuk membandingkan Pure MPI vs Hybrid MPI+OpenMP." />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hybridData} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="config" tickLine={false} axisLine={false} tick={tick} />
            <YAxis tick={tick} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatNumber(value, 2), name]} />
            <Bar dataKey="gflops" name="Throughput (GFLOPS)" fill={chartColors.compute} radius={[4, 4, 0, 0]} />
            <Bar dataKey="comm_pct" name="Komunikasi (%)" fill={chartColors.communication} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (!chartData.length)
      return (
        <EmptyState
          title="Belum ada data untuk ukuran ini"
          description="Pilih dimensi lain atau jalankan eksperimen baru agar metrik muncul di sini."
        />
      );

    const shared = (
      <>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="proses" tickLine={false} axisLine={false} tick={tick} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatNumber(value, 3), name]} />
      </>
    );

    if (tab === "bottleneck")
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            {shared}
            <YAxis tick={tick} tickLine={false} axisLine={false} unit="%" />
            <Bar dataKey="comp_percent" name="Komputasi" stackId="a" fill={chartColors.compute} radius={[0, 0, 0, 0]} />
            <Bar dataKey="comm_percent" name="Komunikasi" stackId="a" fill={chartColors.communication} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );

    if (tab === "speedup")
      return (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            {shared}
            <YAxis
              tick={tick}
              tickLine={false}
              axisLine={false}
              scale={scale === "log" ? "log" : "auto"}
              domain={scale === "log" ? [0.2, "auto"] : [0, "auto"]}
            />
            <Line dataKey="ideal" name="Ideal S=P" stroke={chartColors.ideal} strokeDasharray="5 5" dot={false} />
            <Line dataKey="speedup" name="Speedup aktual" stroke={chartColors.total} strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.total }} />
          </ComposedChart>
        </ResponsiveContainer>
      );

    if (tab === "efficiency")
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
            {shared}
            <YAxis
              tick={tick}
              tickLine={false}
              axisLine={false}
              domain={[0, 1.1]}
              tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            />
            <ReferenceLine y={1} stroke={chartColors.ideal} strokeDasharray="5 5" label={{ value: "100%", fill: "var(--text-muted)", fontSize: 11 }} />
            <Line dataKey="efficiency" name="Efisiensi aktual" stroke={chartColors.compute} strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.compute }} />
          </LineChart>
        </ResponsiveContainer>
      );

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          {shared}
          <YAxis
            tick={tick}
            tickLine={false}
            axisLine={false}
            scale={scale === "log" ? "log" : "auto"}
            domain={scale === "log" ? [0.001, "auto"] : [0, "auto"]}
          />
          <Line dataKey="t_total_s" name="Total" stroke={chartColors.total} strokeWidth={2.2} dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.total }} />
          <Line dataKey="t_comp_s" name="Komputasi" stroke={chartColors.compute} strokeWidth={1.8} dot={{ r: 3, strokeWidth: 0, fill: chartColors.compute }} />
          <Line dataKey="t_comm_s" name="Komunikasi" stroke={chartColors.communication} strokeWidth={1.8} dot={{ r: 3, strokeWidth: 0, fill: chartColors.communication }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="page results-page">
      <PageHeader
        title="Hasil benchmark"
        description="Analisis Strong Scaling (4096×4096), Weak Scaling, Ping-Pong Latency, dan Hybrid MPI+OpenMP."
        actions={
          <>
            <ExportButton label="Unduh CSV" onClick={downloadCsv} />
            <ExportButton label="Unduh PNG" onClick={downloadPng} />
          </>
        }
      />

      <section className="panel filter-panel">
        <div className="filter-title">
          <SlidersHorizontal size={15} strokeWidth={1.6} />
          <strong>Filter</strong>
        </div>
        <label>
          Ukuran matriks
          <select value={matrixSize} onChange={(event) => setMatrixSize(Number(event.target.value))}>
            <option value={4096}>4096 × 4096</option>
            <option value={2048}>2048 × 2048</option>
            <option value={1024}>1024 × 1024</option>
          </select>
        </label>
        <label>
          Sumber CSV
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="results/benchmark_summary.csv">benchmark_summary.csv</option>
            <option value="results/benchmark_results.csv">benchmark_results.csv</option>
          </select>
        </label>
        <label>
          Skala sumbu Y
          <select value={scale} onChange={(event) => setScale(event.target.value as "linear" | "log")}>
            <option value="linear">Linear</option>
            <option value="log">Logaritmik</option>
          </select>
        </label>
        <span className="source-note mono">
          <FileSpreadsheet size={14} strokeWidth={1.6} />
          {source.split("/").pop()}
        </span>
      </section>

      <div ref={chartRef}>
        <ChartCard
          title={tabs.find((item) => item.id === tab)?.label ?? "Grafik benchmark"}
          subtitle={
            tab === "weak"
              ? "Beban FLOPs per proses konstan · N ∝ P^(1/3) (Gustafson's Law)"
              : tab === "latency"
                ? "Uji Ping-Pong antar Rank 0 dan Rank 1 · 4 B hingga 64 MB"
                : tab === "hybrid"
                  ? "Komparasi Pure MPI vs Hybrid MPI + OpenMP (4096 × 4096)"
                  : `Matriks ${matrixSize.toLocaleString("id-ID")} × ${matrixSize.toLocaleString("id-ID")} · ${filtered.length} konfigurasi`
          }
          meta={
            <div className="chart-tabs" role="tablist" aria-label="Jenis grafik">
              {tabs.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? "active" : ""}
                  onClick={() => setTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="results-chart-area">{rows === null ? <Skeleton rows={3} /> : chartContent()}</div>
        </ChartCard>
      </div>

      {commBottleneck ? (
        <InsightCard
          process={commBottleneck.processes}
          comm={commBottleneck.comm_percent}
          efficiency={commBottleneck.efficiency * 100}
        />
      ) : latestFiltered ? (
        <InsightCard
          process={latestFiltered.processes}
          comm={latestFiltered.comm_percent}
          efficiency={latestFiltered.efficiency * 100}
        />
      ) : null}

      <section className="panel results-table-panel">
        <div className="panel-heading">
          <div>
            <h2>
              {tab === "weak"
                ? "Tabel Weak Scaling"
                : tab === "latency"
                  ? "Tabel Latency & Bandwidth"
                  : tab === "hybrid"
                    ? "Tabel Hybrid MPI + OpenMP"
                    : "Tabel metrik Strong Scaling"}
            </h2>
            <p>
              {tab === "weak"
                ? "Perbandingan ukuran matriks dinamis terhadap waktu dan Gustafson speedup"
                : tab === "latency"
                  ? "One-way latency (RTT / 2) dan effective bandwidth per ukuran payload"
                  : tab === "hybrid"
                    ? "Kombinasi jumlah proses MPI dan thread OpenMP pada matriks 4096 × 4096"
                    : "Konfigurasi yang belum dijalankan dapat dipicu langsung dari kolom status"}
            </p>
          </div>
          <span className="table-caption mono">
            {tab === "weak"
              ? `${weakData.length} konfigurasi`
              : tab === "latency"
                ? `${latencyData.length} ukuran paket`
                : tab === "hybrid"
                  ? `${hybridData.length} skenario`
                  : `${filtered.length}/${processOptions.length} konfigurasi`}
          </span>
        </div>

        {tab === "weak" ? (
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Proses</th>
                  <th>Dimensi N</th>
                  <th>Total</th>
                  <th>Komputasi</th>
                  <th>Komunikasi</th>
                  <th>Rasio comm</th>
                  <th>Gustafson S</th>
                  <th>GFLOPS</th>
                </tr>
              </thead>
              <tbody>
                {weakData.map((r) => (
                  <tr key={`${r.processes}-${r.matrix_size}`}>
                    <td><span className="process-pill mono">P={r.processes}</span></td>
                    <td className="mono">{r.matrix_size.toLocaleString("id-ID")}</td>
                    <td className="mono">{formatSeconds(r.t_total_s)}</td>
                    <td className="metric-compute mono">{formatSeconds(r.t_comp_s)}</td>
                    <td className="metric-comm mono">{formatSeconds(r.t_comm_s)}</td>
                    <td><span className={`comm-badge mono ${r.comm_percent < 15 ? "low" : r.comm_percent <= 30 ? "medium" : "high"}`}>{formatPercent(r.comm_percent)}</span></td>
                    <td className="mono strong-cell">{formatNumber(r.gustafson_speedup, 2)}×</td>
                    <td className="mono">{formatNumber(r.throughput_gflops, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "latency" ? (
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Ukuran paket</th>
                  <th>Bytes</th>
                  <th>One-Way Latency (µs)</th>
                  <th>One-Way Latency (ms)</th>
                  <th>Effective Bandwidth</th>
                </tr>
              </thead>
              <tbody>
                {latencyData.map((r) => (
                  <tr key={r.bytes}>
                    <td className="mono strong-cell">{r.size_label}</td>
                    <td className="mono muted-cell">{r.bytes.toLocaleString("id-ID")}</td>
                    <td className="mono">{formatNumber(r.latency_us, 2)} µs</td>
                    <td className="metric-comm mono">{formatNumber(r.latency_ms, 4)} ms</td>
                    <td className="metric-compute mono">{formatNumber(r.bandwidth_mbps, 2)} MB/s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "hybrid" ? (
          <div className="table-scroll">
            <table className="metric-table">
              <thead>
                <tr>
                  <th>Konfigurasi</th>
                  <th>Total Core</th>
                  <th>Total</th>
                  <th>Komputasi (OMP)</th>
                  <th>Komunikasi (MPI)</th>
                  <th>Rasio comm</th>
                  <th>Throughput</th>
                </tr>
              </thead>
              <tbody>
                {hybridData.map((r) => (
                  <tr key={r.config}>
                    <td className="mono strong-cell">{r.config}</td>
                    <td className="mono">{r.total_cores}</td>
                    <td className="mono">{formatSeconds(r.t_total_s)}</td>
                    <td className="metric-compute mono">{formatSeconds(r.t_comp_s)}</td>
                    <td className="metric-comm mono">{formatSeconds(r.t_comm_s)}</td>
                    <td><span className={`comm-badge mono ${r.comm_pct < 12 ? "low" : r.comm_pct <= 25 ? "medium" : "high"}`}>{formatPercent(r.comm_pct)}</span></td>
                    <td className="mono strong-cell">{formatNumber(r.gflops, 2)} GFLOPS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows === null ? (
          <Skeleton rows={4} />
        ) : error ? (
          <div className="form-error">{error}. Periksa koneksi backend.</div>
        ) : (
          <MetricTable
            rows={displayedRows}
            onRun={(processes) => navigate("/jalankan", { state: { mode: "single", processes: [processes] } })}
          />
        )}
      </section>

      <p className="results-note">
        <FileImage size={13} strokeWidth={1.6} />
        <span>Ekspor PNG dirender dari konfigurasi filter yang sedang aktif.</span>
      </p>
    </div>
  );
}
