import type { BenchmarkRow } from "../types";

export const benchmarkData: BenchmarkRow[] = [
  {
    matrix_size: 2048,
    processes: 1,
    t_total_s: 0.227963,
    t_comp_s: 0.21896,
    t_comm_s: 0.008991,
    t_comm_in_s: 0.004764,
    t_comm_out_s: 0.004227,
    comp_percent: 96.05,
    comm_percent: 3.94,
    speedup: 1,
    efficiency: 1,
    throughput_gflops: 75.36,
    executed: true,
  },
  {
    matrix_size: 2048,
    processes: 2,
    t_total_s: 0.124875,
    t_comp_s: 0.109743,
    t_comm_s: 0.015089,
    t_comm_in_s: 0.008846,
    t_comm_out_s: 0.006256,
    comp_percent: 87.88,
    comm_percent: 12.08,
    speedup: 1.83,
    efficiency: 0.91,
    throughput_gflops: 137.58,
    executed: true,
  },
  {
    matrix_size: 2048,
    processes: 4,
    t_total_s: 0.087297,
    t_comp_s: 0.065695,
    t_comm_s: 0.021409,
    t_comm_in_s: 0.01465,
    t_comm_out_s: 0.006883,
    comp_percent: 75.25,
    comm_percent: 24.52,
    speedup: 2.61,
    efficiency: 0.65,
    throughput_gflops: 196.8,
    executed: true,
  },
];

export const processOptions = [1, 2, 4, 8, 16];

export const chartColors = {
  total: "#0EA5E9",
  compute: "#10B981",
  communication: "#F59E0B",
  ideal: "#71717A",
  danger: "#F43F5E",
};

export const recentRuns = [
  { id: "RUN-024", size: 2048, processes: 4, duration: 0.0873, communication: 24.52, status: "Selesai", date: "Hari ini, 10.42" },
  { id: "RUN-023", size: 2048, processes: 2, duration: 0.1249, communication: 12.08, status: "Selesai", date: "Hari ini, 10.18" },
  { id: "RUN-022", size: 2048, processes: 1, duration: 0.228, communication: 3.94, status: "Selesai", date: "Kemarin, 16.30" },
];
