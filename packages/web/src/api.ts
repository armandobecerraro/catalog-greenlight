import { AGENT_FETCH_TIMEOUT_MS, ApiError, parseHttpError, timeoutError } from './utils/apiErrors';

export { AGENT_FETCH_TIMEOUT_MS };

const API_BASE = '/api/v1';

export interface CatalogStats {
  totalEntries: number;
  genres: Record<string, number>;
  recentAdditions: number;
  latestRevenue?: {
    weekStart?: string;
    totalViews: number;
    totalRevenueUsd: number;
    topTitle: string;
  };
}

export interface AgentStep {
  step: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'failed';
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  detail?: string;
  error?: string;
  output?: unknown;
}

export interface Recommendation {
  title: string;
  genre: string;
  justification: string;
  evidence: string;
  opportunity_score?: number;
  wow_pct?: number;
  genre_gap?: number;
  in_cannibal_pair?: boolean;
}

export interface AgentRunResult {
  intent: string;
  answer: string;
  sql?: string;
  queryRows?: unknown[];
  recommendations?: Recommendation[];
  steps: AgentStep[];
  totalLatencyMs: number;
  model: string;
  fallback?: boolean;
}

export interface HealthStatus {
  status: string;
  ready: boolean;
  product?: string;
  error?: string | null;
  timestamp?: string;
  partners?: {
    clickhouse?: string;
    mcp?: string;
    gemini?: string;
  };
}

export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
  enrichment?: string | null;
  language?: string;
}

async function fetchJson<T>(path: string, options: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = AGENT_FETCH_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text();
      throw parseHttpError(res.status, body);
    }
    const data = (await res.json()) as T;
    clearTimeout(timer);
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw timeoutError(timeoutMs);
    }
    throw err;
  }
}

export const api = {
  health: () => fetchJson<HealthStatus>('/health', { timeoutMs: 15_000 }),

  getStats: () => fetchJson<CatalogStats>('/catalog/stats', { timeoutMs: 60_000 }),

  getCatalog: () => fetchJson<{ entries: CatalogEntry[]; count: number }>('/catalog', { timeoutMs: 60_000 }),

  ingest: (body: {
    title: string;
    description: string;
    genre: string;
    releaseDate: string;
    cast: string[];
  }) =>
    fetchJson<{ contentId: string; latencyMs: number }>('/media/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: AGENT_FETCH_TIMEOUT_MS
    }),

  ask: (question: string) =>
    fetchJson<AgentRunResult>('/agent/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
      timeoutMs: AGENT_FETCH_TIMEOUT_MS
    }),

  getGreenlight: (opts?: { refresh?: boolean }) => {
    const qs = opts?.refresh ? '?refresh=1' : '';
    return fetchJson<AgentRunResult>(`/greenlight${qs}`, { timeoutMs: AGENT_FETCH_TIMEOUT_MS });
  }
};

export { fetchJson };
