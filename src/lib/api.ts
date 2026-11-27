import { benchmarkData } from "../data/mock";
import type { ApiOptions, BenchmarkRow, ExperimentParams, RunSummary } from "../types";

export interface FaultParams {
  size: number;
  processes: number;
  failRank: number;
}

export interface FaultResult {
  recovered: boolean;
  integrity: boolean;
  duration: number;
  recovery: number;
  completedBy: number[];
}

const DEFAULT_USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const DEFAULT_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

let mockStore: BenchmarkRow[] = [...benchmarkData];

function resolveConfig(options?: ApiOptions) {
  return {
    useMock: options?.mock ?? DEFAULT_USE_MOCK,
    baseUrl: (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
  };
}

function estimateRow(size: number, processes: number, baselineSeq?: number): BenchmarkRow {
  const existing = mockStore.find((r) => r.matrix_size === size && r.processes === processes && r.executed !== false);
  if (existing) return existing;

  const scaleCube = Math.pow(size / 2048, 3);
  const scaleSquare = Math.pow(size / 2048, 2);
  const tSeqBase = baselineSeq ?? 0.227963 * scaleCube;
  const serialOverhead = 0.04;
  const parallelFactor = processes <= 4 ? 1 / (serialOverhead + (1 - serialOverhead) / processes) : 2.6 + (processes - 4) * 0.05;
  const tComp = Number(((tSeqBase * 0.96) / Math.max(1, parallelFactor)).toFixed(6));
  const tCommIn = Number((0.0048 * scaleSquare * Math.pow(processes, 0.85)).toFixed(6));
  const tCommOut = Number((0.0042 * scaleSquare * Math.pow(processes, 0.45)).toFixed(6));
  const tComm = Number((tCommIn + tCommOut).toFixed(6));
  const tTotal = Number((tComp + tComm).toFixed(6));
  const compPct = Number(((tComp / tTotal) * 100).toFixed(2));
  const commPct = Number(((tComm / tTotal) * 100).toFixed(2));
  const speedup = Number((tSeqBase / tTotal).toFixed(2));
  const efficiency = Number((speedup / processes).toFixed(2));
  const gflops = Number(((2 * Math.pow(size, 3)) / (tTotal * 1e9)).toFixed(2));

  return {
    matrix_size: size,
    processes,
    t_total_s: tTotal,
    t_comp_s: tComp,
    t_comm_s: tComm,
    t_comm_in_s: tCommIn,
    t_comm_out_s: tCommOut,
    comp_percent: compPct,
    comm_percent: commPct,
    speedup,
    efficiency,
    throughput_gflops: gflops,
    executed: true,
  };
}

function upsertMockRows(rows: BenchmarkRow[]) {
  for (const row of rows) {
    const idx = mockStore.findIndex(
      (item) => item.matrix_size === row.matrix_size && item.processes === row.processes,
    );
    if (idx >= 0) {
      mockStore[idx] = row;
    } else {
      mockStore.push(row);
    }
  }
  mockStore.sort((a, b) => a.matrix_size - b.matrix_size || a.processes - b.processes);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`Permintaan gagal (${response.status} ${response.statusText})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  async getResults(options?: ApiOptions): Promise<BenchmarkRow[]> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (useMock) {
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      return [...mockStore];
    }
    return requestJson<BenchmarkRow[]>(`${baseUrl}/api/results`);
  },

  async run(params: ExperimentParams, options?: ApiOptions): Promise<RunSummary> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (useMock) {
      const p = params.processes[0] ?? 4;
      const row = estimateRow(params.size, p);
      upsertMockRows([row]);
      return {
        total: row.t_total_s,
        communication: row.comm_percent,
        gflops: row.throughput_gflops,
        verified: params.verify,
      };
    }
    return requestJson<RunSummary>(`${baseUrl}/api/run`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async benchmark(params: ExperimentParams, options?: ApiOptions): Promise<BenchmarkRow[]> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (useMock) {
      const sortedProcesses = [...params.processes].sort((a, b) => a - b);
      const baseSeq = estimateRow(params.size, 1).t_total_s;
      const rows = sortedProcesses.map((p) => estimateRow(params.size, p, baseSeq));
      upsertMockRows(rows);
      return rows;
    }
    return requestJson<BenchmarkRow[]>(`${baseUrl}/api/benchmark`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async fault(params: FaultParams, options?: ApiOptions): Promise<FaultResult> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (useMock) {
      const completedBy = Array.from({ length: params.processes - 1 }, (_, i) => i + 1).filter(
        (rank) => rank !== params.failRank,
      );
      const scale = Math.pow(params.size / 2048, 3);
      const recovery = Number((0.18 + 0.04 * scale).toFixed(4));
      const duration = Number((0.68 * scale + recovery).toFixed(4));
      return {
        recovered: true,
        integrity: true,
        duration,
        recovery,
        completedBy,
      };
    }
    return requestJson<FaultResult>(`${baseUrl}/api/fault`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  connectLogs(onLine: (line: string) => void, options?: ApiOptions): () => void {
    const { useMock, baseUrl } = resolveConfig(options);
    if (useMock) return () => {};
    const wsUrl = `${baseUrl.replace(/^http/, "ws")}/ws/log`;
    const socket = new WebSocket(wsUrl);
    socket.onmessage = (event) => {
      if (typeof event.data === "string") onLine(event.data);
    };
    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  },
};
