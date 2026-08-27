export interface CatalogStats {
  totalEntries: number;
  genres: Record<string, number>;
  recentAdditions: number;
  topCast: Array<{ name: string; count: number }>;
  latestRevenue?: {
    totalViews: number;
    totalRevenueUsd: number;
    topTitle: string;
  };
}

export interface CatalogEntry {
  id: string;
  title: string;
  description: string;
  genre: string;
  releaseDate: string;
  cast: string[];
  enrichment: string | null;
}

export interface AgentStep {
  step: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  output?: unknown;
  error?: string;
}

export interface AgentRunResult {
  runId: string;
  intent: string;
  userPrompt: string;
  answer: string;
  sql?: string;
  queryRows?: Record<string, unknown>[];
  recommendations?: Array<{
    title: string;
    genre: string;
    justification: string;
    evidence: string;
  }>;
  steps: AgentStep[];
  totalLatencyMs: number;
  model: string;
}

const base = '/api/v1';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || res.statusText);
  }
  return res.json();
}

const greenlightFetch = (url: string) =>
  fetch(url).then(async res => {
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error || res.statusText);
    }
    return res.json() as Promise<AgentRunResult>;
  });

export const api = {
  getStats: () => fetchJson<CatalogStats>(`${base}/catalog/stats`),
  getCatalog: () => fetchJson<{ entries: CatalogEntry[]; count: number }>(`${base}/catalog`),
  getGreenlight: () => greenlightFetch(`${base}/greenlight`),
  ask: (question: string) =>
    fetchJson<AgentRunResult>(`${base}/agent/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    }),
  ingest: (body: {
    title: string;
    description: string;
    genre: string;
    releaseDate: string;
    cast: string[];
  }) =>
    fetchJson<{ success: boolean; contentId: string; latencyMs: number }>(`${base}/media/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
};
