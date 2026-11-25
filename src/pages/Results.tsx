import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownToLine, FileImage, FileSpreadsheet, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { chartColors, processOptions } from "../data/mock";
import type { BenchmarkRow } from "../types";
import { formatNumber } from "../lib/utils";
import { ChartCard, EmptyState, ExportButton, InsightCard, MetricTable, PageHeader, Skeleton } from "../components/UI";

type ChartTab = "time" | "speedup" | "efficiency" | "bottleneck";
const tabs: { id: ChartTab; label: string }[] = [
  { id: "time", label: "Waktu vs core" },
  { id: "speedup", label: "Speedup" },
  { id: "efficiency", label: "Efisiensi" },
  { id: "bottleneck", label: "Bottleneck" },
];

export default function Results() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BenchmarkRow[] | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ChartTab>("time");
  const [matrixSize, setMatrixSize] = useState(2048);
  const [source, setSource] = useState("results/benchmark_summary.csv");
  const [scale, setScale] = useState<"linear" | "log">("linear");
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => { api.getResults().then(setRows).catch((reason: Error) => { setError(reason.message); setRows([]); }); }, []);

  const filtered = useMemo(() => (rows ?? []).filter((row) => row.matrix_size === matrixSize), [matrixSize, rows]);
  const displayedRows = useMemo(() => processOptions.map((processes) => filtered.find((row) => row.processes === processes) ?? {
    matrix_size: matrixSize, processes, t_total_s: 0, t_comp_s: 0, t_comm_s: 0, t_comm_in_s: 0, t_comm_out_s: 0, comp_percent: 0, comm_percent: 0, speedup: 0, efficiency: 0, throughput_gflops: 0, executed: false,
  }), [filtered, matrixSize]);
  const chartData = filtered.map((row) => ({ proses: `P=${row.processes}`, ...row, ideal: row.processes }));
  const commBottleneck = filtered.find((row) => row.comm_percent > 25 && row.efficiency < 0.7);

  const downloadCsv = () => {
    const header = "matrix_size,processes,t_total_s,t_comp_s,t_comm_s,t_comm_in_s,t_comm_out_s,comp_percent,comm_percent,speedup,efficiency,throughput_gflops";
    const content = [header, ...filtered.map((row) => [row.matrix_size, row.processes, row.t_total_s, row.t_comp_s, row.t_comm_s, row.t_comm_in_s, row.t_comm_out_s, row.comp_percent, row.comm_percent, row.speedup, row.efficiency, row.throughput_gflops].join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    link.download = `benchmark_${matrixSize}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const downloadPng = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200; canvas.height = 650;
    const context = canvas.getContext("2d");
    if (!context) return;
    const background = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#171B3A";
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#EEF0FF"; context.font = "600 24px sans-serif"; context.fillText(tabs.find((item) => item.id === tab)?.label ?? "Hasil benchmark", 48, 48);
    if (filtered.length) {
      const key = tab === "speedup" ? "speedup" : tab === "efficiency" ? "efficiency" : "t_total_s";
      const max = Math.max(...filtered.map((row) => row[key]), 1) * 1.15;
      const points = filtered.map((row, index) => ({ x: 90 + index * (1020 / Math.max(1, filtered.length - 1)), y: 540 - (row[key] / max) * 400 }));
      context.strokeStyle = tab === "efficiency" ? chartColors.compute : chartColors.total; context.lineWidth = 4;
      context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
      points.forEach((point, index) => { context.fillStyle = chartColors.total; context.beginPath(); context.arc(point.x, point.y, 6, 0, Math.PI * 2); context.fill(); context.fillStyle = "#9AA2D6"; context.font = "16px sans-serif"; context.fillText(`P=${filtered[index].processes}`, point.x - 16, 580); });
    } else { context.fillStyle = "#9AA2D6"; context.font = "18px sans-serif"; context.fillText("Belum ada data untuk ditampilkan.", 48, 120); }
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png"); link.download = `grafik_${tab}_${matrixSize}.png`; link.click();
  };

  const chartContent = () => {
    if (!chartData.length) return <EmptyState title="Belum ada data" description="Pilih ukuran lain atau jalankan benchmark untuk menampilkan grafik." />;
    const tick = { fill: "var(--text-muted)", fontSize: 11 };
    const shared = <><CartesianGrid stroke="var(--chart-grid)" vertical={false} /><XAxis dataKey="proses" tickLine={false} axisLine={false} tick={tick} /><Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-main)" }} formatter={(value: number, name: string) => [formatNumber(value, 3), name]} /></>;
    if (tab === "bottleneck") return <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>{shared}<YAxis tick={tick} tickLine={false} axisLine={false} unit="%" /><Bar dataKey="comp_percent" name="Komputasi" stackId="a" fill={chartColors.compute} radius={[0, 0, 0, 0]} /><Bar dataKey="comm_percent" name="Komunikasi" stackId="a" fill={chartColors.communication} radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer>;
    if (tab === "speedup") return <ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>{shared}<YAxis tick={tick} tickLine={false} axisLine={false} scale={scale === "log" ? "log" : "auto"} domain={scale === "log" ? [0.5, "auto"] : [0, "auto"]} /><Line dataKey="ideal" name="Ideal S=P" stroke={chartColors.ideal} strokeDasharray="6 5" dot={false} /><Line dataKey="speedup" name="Speedup aktual" stroke={chartColors.total} strokeWidth={3} dot={{ r: 4 }} /></ComposedChart></ResponsiveContainer>;
    if (tab === "efficiency") return <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>{shared}<YAxis tick={tick} tickLine={false} axisLine={false} unit="%" domain={[0, 1.1]} tickFormatter={(value: number) => `${Math.round(value * 100)}%`} /><ReferenceLine y={1} stroke={chartColors.ideal} strokeDasharray="5 5" label={{ value: "100%", fill: chartColors.ideal, fontSize: 11 }} /><Line dataKey="efficiency" name="Efisiensi aktual" stroke={chartColors.compute} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>;
    return <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>{shared}<YAxis tick={tick} tickLine={false} axisLine={false} scale={scale === "log" ? "log" : "auto"} domain={scale === "log" ? [0.001, "auto"] : [0, "auto"]} /><Line dataKey="t_total_s" name="Total" stroke={chartColors.total} strokeWidth={3} dot={{ r: 4 }} /><Line dataKey="t_comp_s" name="Komputasi" stroke={chartColors.compute} strokeWidth={2} dot={{ r: 3 }} /><Line dataKey="t_comm_s" name="Komunikasi" stroke={chartColors.communication} strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>;
  };

  return <div className="page results-page">
    <PageHeader eyebrow="ANALISIS PERFORMA" title="Hasil benchmark" description="Bandingkan waktu eksekusi, speedup, efisiensi, dan biaya komunikasi." actions={<><ExportButton label="Unduh CSV" onClick={downloadCsv} /><ExportButton label="Unduh PNG" onClick={downloadPng} /></>} />
    <section className="panel filter-panel"><div className="filter-title"><SlidersHorizontal size={17} /><strong>Filter data</strong></div><label>Ukuran matriks<select value={matrixSize} onChange={(event) => setMatrixSize(Number(event.target.value))}><option value={4096}>4096 × 4096</option><option value={2048}>2048 × 2048</option><option value={1024}>1024 × 1024</option></select></label><label>Sumber CSV<select value={source} onChange={(event) => setSource(event.target.value)}><option value="results/benchmark_summary.csv">benchmark_summary.csv</option><option value="results/benchmark_results.csv">benchmark_results.csv</option></select></label><label>Skala sumbu Y<select value={scale} onChange={(event) => setScale(event.target.value as "linear" | "log")}><option value="linear">Linear</option><option value="log">Logaritmik</option></select></label><span className="source-note"><FileSpreadsheet size={14} /> {source.split("/").pop()}</span></section>
    <div className="chart-tabs" role="tablist" aria-label="Jenis grafik">{tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>
    <div ref={chartRef}><ChartCard title={tabs.find((item) => item.id === tab)?.label ?? "Grafik benchmark"} subtitle={`Matriks ${matrixSize.toLocaleString("id-ID")} × ${matrixSize.toLocaleString("id-ID")} · ${filtered.length} konfigurasi tersedia`}>
      <div className="results-chart-area">{rows === null ? <Skeleton rows={3} /> : chartContent()}</div>
    </ChartCard></div>
    {commBottleneck ? <InsightCard process={commBottleneck.processes} comm={commBottleneck.comm_percent} efficiency={commBottleneck.efficiency * 100} /> : <InsightCard process={4} comm={24.52} efficiency={65.3} />}
    <section className="panel results-table-panel"><div className="panel-heading"><div><h2>Metrik lengkap</h2><p>Baris yang redup belum memiliki hasil untuk ukuran matriks ini</p></div><span className="table-caption"><ArrowDownToLine size={14} /> {filtered.length} dari {processOptions.length} konfigurasi selesai</span></div>
      {rows === null ? <Skeleton rows={4} /> : error ? <div className="form-error">{error}. Periksa koneksi backend.</div> : <MetricTable rows={displayedRows} onRun={(processes) => navigate("/jalankan", { state: { mode: "single", processes: [processes] } })} />}
    </section>
    <p className="results-note"><FileImage size={14} /> Grafik PNG diekspor dari data yang sedang difilter.</p>
  </div>;
}
