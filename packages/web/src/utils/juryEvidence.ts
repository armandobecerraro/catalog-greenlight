import type { AgentRunResult } from "../api";

export interface JuryEvidenceJson {
  intent: string;
  model: string;
  fallback: boolean;
  recommendations: Array<{
    title: string;
    genre: string;
    opportunity_score?: number;
    wow_pct?: number;
    genre_gap?: number;
  }>;
  sql: string | null;
}

export function juryEvidencePayload(run: AgentRunResult | null): JuryEvidenceJson | null {
  if (!run) return null;
  return {
    intent: run.intent,
    model: run.model,
    fallback: Boolean(run.fallback),
    recommendations: (run.recommendations ?? []).map((r) => ({
      title: r.title,
      genre: r.genre,
      opportunity_score: r.opportunity_score,
      wow_pct: r.wow_pct,
      genre_gap: r.genre_gap,
    })),
    sql: run.sql ?? null,
  };
}
