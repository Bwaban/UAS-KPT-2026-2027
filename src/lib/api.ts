import { benchmarkData, extraMetricsMock } from "../data/mock";
import type {
  ApiOptions,
  BenchmarkRow,
  ExperimentParams,
  ExtraMetrics,
  RunSummary,
  SystemInfo,
} from "../types";

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

const ENV_MOCK = import.meta.env.VITE_USE_MOCK;
const DEFAULT_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" && window.location.port === "8000" ? window.location.origin : "http://localhost:8000")
).replace(/\/+$/, "");

let mockStore: BenchmarkRow[] = [...benchmarkData];
let detectedBackendLive: boolean | null = null;

function resolveConfig(options?: ApiOptions) {
  const baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  if (options?.mock !== undefined) {
    return { useMock: options.mock, baseUrl };
  }
  if (ENV_MOCK === "true") return { useMock: true, baseUrl };
  if (ENV_MOCK === "false") return { useMock: false, baseUrl };
  // Auto mode: prefer live FastAPI if reachable, otherwise fall back to embedded real dataset
  return { useMock: detectedBackendLive === false, baseUrl };
}

function estimateRow(size: number, processes: number, baselineSeq?: number): BenchmarkRow {
  const existing = mockStore.find((r) => r.matrix_size === size && r.processes === processes && r.executed !== false);
  if (existing) return existing;

  const scaleCube = Math.pow(size / 4096, 3);
  const scaleSquare = Math.pow(size / 4096, 2);
  const tSeqBase = baselineSeq ?? 2.15 * scaleCube;
  const serialOverhead = 0.08;
  const parallelFactor = processes <= 4 ? 1 / (serialOverhead + (1 - serialOverhead) / processes) : 1.7;
  const tComp = Number(((tSeqBase * 0.94) / Math.max(1, parallelFactor)).toFixed(6));
  const tCommIn = Number((0.04 * scaleSquare * Math.pow(processes, 1.15)).toFixed(6));
  const tCommOut = Number((0.03 * scaleSquare * Math.pow(processes, 0.7)).toFixed(6));
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
    if (idx >= 0) mockStore[idx] = row;
    else mockStore.push(row);
  }
  mockStore.sort((a, b) => a.matrix_size - b.matrix_size || a.processes - b.processes);
}

async function requestJson<T>(url: string, init?: RequestInit, timeoutMs = 0): Promise<T> {
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: controller?.signal,
      ...init,
    });
    if (!response.ok) {
      let detail = `${response.status} ${response.statusText}`;
      try {
        const body = (await response.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        // ignore parse failure
      }
      throw new Error(detail);
    }
    return (await response.json()) as T;
  } finally {
    if (timer !== null) window.clearTimeout(timer);
  }
}

export const api = {
  isLiveBackend(): boolean {
    return ENV_MOCK === "false" || detectedBackendLive === true;
  },

  async getSystem(options?: ApiOptions): Promise<SystemInfo & { live: boolean }> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const info = await requestJson<SystemInfo>(`${baseUrl}/api/system`, undefined, 1500);
        detectedBackendLive = true;
        return { ...info, live: true };
      } catch {
        if (ENV_MOCK === "false") {
          return {
            mpi_available: false,
            mpi_cmd: "Offline",
            python_version: "3.11",
            cpu_physical: 4,
            cpu_logical: 8,
            cpu_percent: 0,
            ram_percent: 0,
            ram_used_mb: 0,
            ram_total_mb: 0,
            live: false,
          };
        }
        detectedBackendLive = false;
      }
    }
    return {
      mpi_available: true,
      mpi_cmd: "mpiexec (snapshot)",
      python_version: "3.11.9",
      cpu_physical: 4,
      cpu_logical: 8,
      cpu_percent: 0,
      ram_percent: 0,
      ram_used_mb: 0,
      ram_total_mb: 0,
      live: false,
    };
  },

  async getResults(source = "results/benchmark_summary.csv", options?: ApiOptions): Promise<BenchmarkRow[]> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const data = await requestJson<BenchmarkRow[]>(
          `${baseUrl}/api/results?source=${encodeURIComponent(source)}`,
          undefined,
          2500,
        );
        detectedBackendLive = true;
        return data;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return [...mockStore];
  },

  async getExtra(options?: ApiOptions): Promise<ExtraMetrics> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const data = await requestJson<ExtraMetrics>(`${baseUrl}/api/extra`, undefined, 2500);
        detectedBackendLive = true;
        return data;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    return extraMetricsMock;
  },

  async run(params: ExperimentParams, options?: ApiOptions): Promise<RunSummary> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const res = await requestJson<RunSummary>(`${baseUrl}/api/run`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        detectedBackendLive = true;
        return res;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    const p = params.processes[0] ?? 4;
    const row = estimateRow(params.size, p);
    upsertMockRows([row]);
    return {
      total: row.t_total_s,
      communication: row.comm_percent,
      gflops: row.throughput_gflops,
      verified: params.verify,
    };
  },

  async benchmark(params: ExperimentParams, options?: ApiOptions): Promise<BenchmarkRow[]> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const res = await requestJson<BenchmarkRow[]>(`${baseUrl}/api/benchmark`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        detectedBackendLive = true;
        return res;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    const sortedProcesses = [...params.processes].sort((a, b) => a - b);
    const baseSeq = estimateRow(params.size, 1).t_total_s;
    const rows = sortedProcesses.map((p) => estimateRow(params.size, p, baseSeq));
    upsertMockRows(rows);
    return rows;
  },

  async hybrid(params: ExperimentParams, options?: ApiOptions): Promise<RunSummary> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const res = await requestJson<RunSummary>(`${baseUrl}/api/hybrid`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        detectedBackendLive = true;
        return res;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    const p = params.processes[0] ?? 2;
    const t = params.threads ?? 4;
    const match = extraMetricsMock.hybrid.find((r) => r.mpi_procs === p && r.omp_threads === t);
    if (match) {
      return { total: match.t_total_s, communication: match.comm_pct, gflops: match.gflops, verified: true };
    }
    const row = estimateRow(params.size, p * t);
    return { total: row.t_total_s, communication: Number((row.comm_percent * 0.5).toFixed(2)), gflops: row.throughput_gflops, verified: true };
  },

  async latency(params: ExperimentParams, options?: ApiOptions): Promise<RunSummary> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const res = await requestJson<RunSummary>(`${baseUrl}/api/latency`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        detectedBackendLive = true;
        return res;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    const rows = extraMetricsMock.latency;
    const peakBw = Math.max(...rows.map((r) => r.bandwidth_mbps));
    return { total: rows[rows.length - 1].latency_ms / 1000, communication: 100, gflops: peakBw, verified: true };
  },

  async fault(params: FaultParams, options?: ApiOptions): Promise<FaultResult> {
    const { useMock, baseUrl } = resolveConfig(options);
    if (!useMock) {
      try {
        const res = await requestJson<FaultResult>(`${baseUrl}/api/fault`, {
          method: "POST",
          body: JSON.stringify(params),
        });
        detectedBackendLive = true;
        return res;
      } catch (err) {
        if (ENV_MOCK === "false") throw err;
        detectedBackendLive = false;
      }
    }
    const completedBy = Array.from({ length: params.processes - 1 }, (_, i) => i + 1).filter(
      (rank) => rank !== params.failRank,
    );
    const scale = Math.pow(params.size / 2048, 3);
    const recovery = Number((0.18 + 0.04 * scale).toFixed(4));
    const duration = Number((0.88 * scale + recovery).toFixed(4));
    return { recovered: true, integrity: true, duration, recovery, completedBy };
  },

  connectLogs(onLine: (line: string) => void, options?: ApiOptions): () => void {
    const { useMock, baseUrl } = resolveConfig(options);
    if (useMock) return () => {};
    try {
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
    } catch {
      return () => {};
    }
  },
};
