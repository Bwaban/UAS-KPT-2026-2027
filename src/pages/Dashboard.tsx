import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Clock3, Layers3, Play, Plus, ShieldAlert, Terminal } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { benchmarkData, chartColors, recentRuns as fallbackRecentRuns } from "../data/mock";
import type { BenchmarkRow, RecentRun } from "../types";
import { formatNumber, formatPercent, formatSeconds } from "../lib/utils";
import { ChartCard, EmptyState, KpiCard, PageHeader, Skeleton } from "../components/UI";

export default function Dashboard() {
  const [rows, setRows] = useState<BenchmarkRow[] | null>(null);
  const [recent, setRecent] = useState<RecentRun[]>(fallbackRecentRuns);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .getResults()
      .then((data) => {
        if (data.length) {
          const maxSize = Math.max(...data.map((r) => r.matrix_size));
          setRows(data.filter((r) => r.matrix_size === maxSize));
        } else {
          setRows([]);
        }
      })
      .catch((reason: Error) => {
        setError(reason.message);
        setRows([]);
      });
    api
      .getExtra()
      .then((extra) => {
        if (extra.recent_runs && extra.recent_runs.length) {
          setRecent(extra.recent_runs);
        }
      })
      .catch(() => {});
  }, []);

  const selected = rows?.length ? rows : benchmarkData;
  const best = selected.reduce((bestRow, row) => (row.speedup > bestRow.speedup ? row : bestRow), selected[0]);
  const bestGflops = selected.reduce((max, row) => Math.max(max, row.throughput_gflops), 0);
  const last = selected[selected.length - 1];
  const matrixLabel = `${best.matrix_size.toLocaleString("id-ID")} × ${best.matrix_size.toLocaleString("id-ID")}`;
  const chartData = selected.map((row) => ({
    proses: `P=${row.processes}`,
    total: row.t_total_s,
    compute: row.t_comp_s,
    communication: row.t_comm_s,
  }));

  return (
    <div className="page dashboard-page">
      <PageHeader
        title="Ringkasan performa"
        description={`Benchmark perkalian matriks terdistribusi MPI4Py pada dimensi ${matrixLabel}.`}
        actions={
          <>
            <Link className="button-secondary" to="/hasil">
              <span>Lihat hasil</span>
              <ArrowUpRight size={14} strokeWidth={1.6} />
            </Link>
            <Link className="button-primary" to="/jalankan">
              <Plus size={15} strokeWidth={2} />
              <span>Eksperimen baru</span>
            </Link>
          </>
        }
      />

      {error && (
        <div className="form-error">
          Data belum dapat dimuat dari backend. Pastikan server aktif atau aktifkan mode mock.
        </div>
      )}

      <section className="kpi-strip" aria-label="Metrik utama">
        {rows === null ? (
          <div className="kpi-skeleton-wrap">
            <Skeleton rows={2} />
          </div>
        ) : (
          <>
            <KpiCard
              label="Speedup puncak"
              value={`${formatNumber(best.speedup, 2)}×`}
              detail={`P=${best.processes} · N=${best.matrix_size.toLocaleString("id-ID")}`}
              tone="accent"
            />
            <KpiCard
              label="Throughput"
              value={`${formatNumber(bestGflops, 1)}`}
              detail={`GFLOPS · beban ${best.matrix_size}²`}
              tone="compute"
            />
            <KpiCard
              label="Overhead komunikasi"
              value={formatPercent(last.comm_percent)}
              detail={`T_comm ${formatSeconds(last.t_comm_s)} · P=${last.processes}`}
              tone="comm"
            />
            <KpiCard
              label="Efisiensi paralel"
              value={formatPercent(best.efficiency * 100)}
              detail={`Rasio S/P pada P=${best.processes}`}
              tone="neutral"
            />
          </>
        )}
      </section>

      <div className="dashboard-main-grid">
        <ChartCard
          title="Waktu eksekusi terhadap jumlah proses"
          subtitle={`Matriks ${matrixLabel} · durasi dalam detik`}
          className="dashboard-chart"
          meta={
            <div className="chart-legend">
              <span>
                <i className="legend-dot total" /> Total
              </span>
              <span>
                <i className="legend-dot compute" /> Komputasi
              </span>
              <span>
                <i className="legend-dot communication" /> Komunikasi
              </span>
            </div>
          }
        >
          <div className="chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="proses"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "Geist Mono, monospace" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--text-muted)", fontSize: 11, fontFamily: "Geist Mono, monospace" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 8,
                    color: "var(--text-main)",
                    fontSize: 12,
                    fontFamily: "Geist Mono, monospace",
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(4)} dtk`,
                    name === "total" ? "Total" : name === "compute" ? "Komputasi" : "Komunikasi",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={chartColors.total}
                  strokeWidth={2.2}
                  dot={{ r: 3.5, strokeWidth: 0, fill: chartColors.total }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="compute"
                  stroke={chartColors.compute}
                  strokeWidth={1.8}
                  dot={{ r: 3, strokeWidth: 0, fill: chartColors.compute }}
                />
                <Line
                  type="monotone"
                  dataKey="communication"
                  stroke={chartColors.communication}
                  strokeWidth={1.8}
                  dot={{ r: 3, strokeWidth: 0, fill: chartColors.communication }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Skenario cepat</h2>
              <p>Preset perintah MPI yang paling sering diuji</p>
            </div>
            <Terminal size={16} strokeWidth={1.6} className="muted-icon" />
          </div>

          <div className="quick-list">
            <Link className="quick-action" to="/jalankan" state={{ mode: "hybrid", size: 4096, processes: [2], threads: 4 }}>
              <span className="quick-icon">
                <Play size={14} strokeWidth={1.7} />
              </span>
              <span>
                <strong>Hybrid MPI + OpenMP</strong>
                <small className="mono">2 MPI × 4 OMP · 4096²</small>
              </span>
              <ArrowUpRight size={14} strokeWidth={1.6} />
            </Link>

            <Link className="quick-action" to="/jalankan" state={{ mode: "benchmark", size: 4096, processes: [1, 2, 4, 8, 16], weakScaling: true }}>
              <span className="quick-icon">
                <Layers3 size={14} strokeWidth={1.7} />
              </span>
              <span>
                <strong>Strong + Weak scaling</strong>
                <small className="mono">P=1, 2, 4, 8, 16</small>
              </span>
              <ArrowUpRight size={14} strokeWidth={1.6} />
            </Link>

            <Link className="quick-action" to="/jalankan" state={{ mode: "latency", trials: 20 }}>
              <span className="quick-icon">
                <Terminal size={14} strokeWidth={1.7} />
              </span>
              <span>
                <strong>Ping-Pong latency</strong>
                <small className="mono">4 B – 64 MB · RTT & BW</small>
              </span>
              <ArrowUpRight size={14} strokeWidth={1.6} />
            </Link>

            <Link className="quick-action" to="/fault">
              <span className="quick-icon">
                <ShieldAlert size={14} strokeWidth={1.7} />
              </span>
              <span>
                <strong>Simulasi node gagal</strong>
                <small className="mono">Rank 2 crash · recovery</small>
              </span>
              <ArrowUpRight size={14} strokeWidth={1.6} />
            </Link>
          </div>

          <div className="quick-note">
            <Clock3 size={13} strokeWidth={1.6} />
            <span>Hasil pengujian tersimpan otomatis ke CSV</span>
          </div>
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h2>Riwayat eksekusi</h2>
            <p>Pengukuran benchmark terakhir yang tercatat</p>
          </div>
          <Link className="text-button" to="/hasil">
            <span>Semua hasil</span>
            <ArrowUpRight size={14} strokeWidth={1.6} />
          </Link>
        </div>

        <div className="table-scroll">
          <table className="metric-table recent-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Dimensi</th>
                <th>Proses</th>
                <th>Waktu total</th>
                <th>Rasio comm</th>
                <th>Status</th>
                <th>Waktu catat</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((run) => (
                <tr key={`${run.id}-${run.date}`}>
                  <td className="mono strong-cell">{run.id}</td>
                  <td className="mono">
                    {run.size.toLocaleString("id-ID")} × {run.size.toLocaleString("id-ID")}
                  </td>
                  <td>
                    <span className="process-pill mono">P={run.processes}</span>
                  </td>
                  <td className="mono">{formatSeconds(run.duration)}</td>
                  <td>
                    <span
                      className={`comm-badge mono ${
                        run.communication < 15 ? "low" : run.communication <= 30 ? "medium" : "high"
                      }`}
                    >
                      {formatPercent(run.communication)}
                    </span>
                  </td>
                  <td>
                    <span className="status-label">Selesai</span>
                  </td>
                  <td className="muted-cell mono">{run.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows?.length === 0 && (
          <EmptyState
            title="Belum ada hasil"
            description="Jalankan eksperimen pertama untuk melihat ringkasan performa."
          />
        )}
      </section>
    </div>
  );
}
