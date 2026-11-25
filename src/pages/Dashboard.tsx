import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, Gauge, Layers3, Network, Plus, Rocket, TrendingUp, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { benchmarkData, chartColors, recentRuns } from "../data/mock";
import type { BenchmarkRow } from "../types";
import { formatNumber, formatPercent, formatSeconds } from "../lib/utils";
import { ChartCard, EmptyState, KpiCard, PageHeader, Skeleton } from "../components/UI";

export default function Dashboard() {
  const [rows, setRows] = useState<BenchmarkRow[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.getResults().then(setRows).catch((reason: Error) => { setError(reason.message); setRows([]); });
  }, []);
  const selected = rows?.length ? rows : benchmarkData;
  const best = selected.reduce((bestRow, row) => row.speedup > bestRow.speedup ? row : bestRow, selected[0]);
  const bestGflops = selected.reduce((max, row) => Math.max(max, row.throughput_gflops), 0);
  const last = selected[selected.length - 1];
  const chartData = selected.map((row) => ({ proses: `P=${row.processes}`, total: row.t_total_s, compute: row.t_comp_s, communication: row.t_comm_s }));
  return <div className="page dashboard-page">
    <PageHeader eyebrow="LABORATORIUM KOMPUTASI PARALEL" title="Selamat datang di Matrix Lab" description="Pantau performa perkalian matriks terdistribusi dan mulai eksperimen baru."
      actions={<><Link className="button-primary" to="/jalankan"><Plus size={16} /> Eksperimen baru</Link><Link className="button-secondary" to="/hasil">Lihat hasil <ArrowUpRight size={15} /></Link></>} />
    {error && <div className="form-error">Data belum dapat dimuat. Pastikan backend aktif, atau gunakan mode mock.</div>}
    <section className="kpi-grid">
      {rows === null ? <Skeleton rows={4} /> : <>
        <KpiCard label="Speedup terbaik" value={`${formatNumber(best.speedup, 2)}×`} detail={`Pada P=${best.processes} · N=${best.matrix_size.toLocaleString("id-ID")}`} icon={TrendingUp} tone="indigo" />
        <KpiCard label="Throughput tertinggi" value={`${formatNumber(bestGflops, 1)}`} detail="GFLOPS · beban matriks 2048²" icon={Zap} tone="teal" />
        <KpiCard label="Komunikasi" value={formatPercent(last.comm_percent)} detail={`T_comm ${formatSeconds(last.t_comm_s)} · P=${last.processes}`} icon={Network} tone="orange" />
        <KpiCard label="Efisiensi paralel" value={formatPercent(best.efficiency * 100)} detail={`Pada konfigurasi P=${best.processes}`} icon={Gauge} tone="yellow" />
      </>}
    </section>
    <div className="dashboard-main-grid">
      <ChartCard title="Waktu eksekusi vs jumlah proses" subtitle="Matriks 2048 × 2048 · durasi dalam detik" className="dashboard-chart">
        <div className="chart-legend"><span><i className="legend-dot total" /> Total</span><span><i className="legend-dot compute" /> Komputasi</span><span><i className="legend-dot communication" /> Komunikasi</span></div>
        <div className="chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="proses" tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
          <Tooltip contentStyle={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text-main)" }} formatter={(value: number, name: string) => [`${value.toFixed(4)} dtk`, name === "total" ? "Total" : name === "compute" ? "Komputasi" : "Komunikasi"]} />
          <Line type="monotone" dataKey="total" stroke={chartColors.total} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          <Line type="monotone" dataKey="compute" stroke={chartColors.compute} strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="communication" stroke={chartColors.communication} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart></ResponsiveContainer></div>
      </ChartCard>
      <section className="panel quick-panel"><div className="panel-heading"><div><h2>Aksi cepat</h2><p>Pilih skenario yang ingin dijalankan</p></div><Rocket size={18} className="muted-icon" /></div>
        <Link className="quick-action" to="/jalankan"><span className="quick-icon teal-bg"><Zap size={17} /></span><span><strong>Uji tunggal</strong><small>P=4 · validasi hasil</small></span><ArrowUpRight size={15} /></Link>
        <Link className="quick-action" to="/jalankan" state={{ mode: "benchmark", processes: [1, 2, 4, 8, 16] }}><span className="quick-icon indigo-bg"><Layers3 size={17} /></span><span><strong>Benchmark scaling</strong><small>P=1, 2, 4, 8, 16</small></span><ArrowUpRight size={15} /></Link>
        <Link className="quick-action" to="/fault"><span className="quick-icon coral-bg"><Network size={17} /></span><span><strong>Simulasi node gagal</strong><small>Uji pemulihan dinamis</small></span><ArrowUpRight size={15} /></Link>
        <div className="quick-note"><Clock3 size={14} /> Data benchmark terakhir tersimpan otomatis</div>
      </section>
    </div>
    <section className="panel recent-panel"><div className="panel-heading"><div><h2>Eksekusi terakhir</h2><p>Riwayat pengukuran benchmark Anda</p></div><Link className="text-button" to="/hasil">Semua hasil <ArrowUpRight size={14} /></Link></div>
      <div className="table-scroll"><table className="metric-table recent-table"><thead><tr><th>ID eksperimen</th><th>Matriks</th><th>Proses</th><th>Waktu total</th><th>% komunikasi</th><th>Status</th><th>Waktu</th></tr></thead><tbody>{recentRuns.map((run) => <tr key={run.id}><td className="mono">{run.id}</td><td>{run.size.toLocaleString("id-ID")} × {run.size.toLocaleString("id-ID")}</td><td>P={run.processes}</td><td className="metric-indigo mono">{formatSeconds(run.duration)}</td><td><span className={`comm-badge ${run.communication < 15 ? "low" : run.communication <= 30 ? "medium" : "high"}`}>{formatPercent(run.communication)}</span></td><td><span className="status-label">Selesai</span></td><td className="muted-cell">{run.date}</td></tr>)}</tbody></table></div>
      {rows?.length === 0 && <EmptyState title="Belum ada hasil" description="Jalankan eksperimen pertama untuk melihat ringkasan performa." />}
    </section>
  </div>;
}
