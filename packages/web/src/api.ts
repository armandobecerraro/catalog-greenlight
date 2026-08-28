const API_BASE = '/api/v1';

/** Agent calls (Gemini + ClickHouse Cloud) can take ~3 minutes under load. */
export const AGENT_FETCH_TIMEOUT_MS = 240_000;

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

async function fetchJson<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? AGENT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const { timeoutMs: _omit, ...fetchOptions } = options ?? {};

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${timeoutMs / 1000}s. The agent (Gemini + ClickHouse) can take 1–2 minutes — please wait and retry.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => fetchJson<{ status: string; ready: boolean }>('/health', { timeoutMs: 15_000 }),

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

  getGreenlight: () => fetchJson<AgentRunResult>('/greenlight', { timeoutMs: AGENT_FETCH_TIMEOUT_MS })
};
