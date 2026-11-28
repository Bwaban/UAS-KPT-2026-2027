export interface BenchmarkRow {
  matrix_size: number;
  processes: number;
  t_total_s: number;
  t_comp_s: number;
  t_comm_s: number;
  t_comm_in_s: number;
  t_comm_out_s: number;
  comp_percent: number;
  comm_percent: number;
  speedup: number;
  efficiency: number;
  throughput_gflops: number;
  executed?: boolean;
}

export interface WeakScalingRow {
  processes: number;
  matrix_size: number;
  t_total_s: number;
  t_comp_s: number;
  t_comm_s: number;
  comp_percent: number;
  comm_percent: number;
  throughput_gflops: number;
  gustafson_speedup: number;
  weak_efficiency: number;
}

export interface LatencyRow {
  bytes: number;
  size_label: string;
  latency_us: number;
  latency_ms: number;
  bandwidth_mbps: number;
}

export interface HybridRow {
  matrix_size: number;
  mpi_procs: number;
  omp_threads: number;
  total_cores: number;
  t_total_s: number;
  t_comp_s: number;
  t_comm_s: number;
  comp_pct: number;
  comm_pct: number;
  gflops: number;
}

export interface RecentRun {
  id: string;
  size: number;
  processes: number;
  duration: number;
  communication: number;
  gflops?: number;
  status: string;
  date: string;
}

export interface ExtraMetrics {
  weak_scaling: WeakScalingRow[];
  latency: LatencyRow[];
  hybrid: HybridRow[];
  fault_log: string;
  recent_runs?: RecentRun[];
}

export interface SystemInfo {
  mpi_available: boolean;
  mpi_cmd: string;
  python_version: string;
  cpu_physical: number;
  cpu_logical: number;
  cpu_percent: number;
  ram_percent: number;
  ram_used_mb: number;
  ram_total_mb: number;
  net_sent_mb?: number;
  net_recv_mb?: number;
}

export type RunMode = "single" | "benchmark" | "hybrid" | "latency";

export interface ExperimentParams {
  mode: RunMode;
  size: number;
  processes: number[];
  seed: number;
  csvPath: string;
  verify: boolean;
  save: boolean;
  threads?: number;
  weakScaling?: boolean;
  trials?: number;
}

export interface RunSummary {
  total: number;
  wall_clock?: number;
  seq_time?: number | null;
  communication: number;
  gflops: number;
  verified: boolean;
}

export interface ApiOptions {
  mock?: boolean;
  baseUrl?: string;
}

export type StageStatus = "waiting" | "active" | "complete" | "error";
