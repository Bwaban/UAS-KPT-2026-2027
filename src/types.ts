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

export type RunMode = "single" | "benchmark";

export interface ExperimentParams {
  mode: RunMode;
  size: number;
  processes: number[];
  seed: number;
  csvPath: string;
  verify: boolean;
  save: boolean;
}

export interface RunSummary {
  total: number;
  communication: number;
  gflops: number;
  verified: boolean;
}

export interface ApiOptions {
  mock?: boolean;
  baseUrl?: string;
}

export type StageStatus = "waiting" | "active" | "complete" | "error";
