import type { AgentRunResult } from "../api";
import { downloadTextFile } from "./greenlightExport";

export interface JuryEvidenceJson {
  exportedAt: string;
  product: string;
  intent: string;
  model: string;
  fallback: boolean;
  totalLatencyMs: number;
  uniqueGenres: string[];
  mcpQueryIds: string[];
  recommendations: Array<{
    title: string;
    genre: string;
    opportunity_score?: number;
    wow_pct?: number;
    genre_gap?: number;
    in_cannibal_pair?: boolean;
  }>;
  sql: string | null;
  attribution: string;
}

const MCP_QUERY_IDS = [
  "A_genre_inventory",
  "B_title_momentum",
  "C_cannibalization",
  "D_slate_holes",
];

export function juryEvidencePayload(run: AgentRunResult | null): JuryEvidenceJson | null {
  if (!run) return null;
  const recommendations = (run.recommendations ?? []).map((r) => ({
    title: r.title,
    genre: r.genre,
    opportunity_score: r.opportunity_score,
    wow_pct: r.wow_pct,
    genre_gap: r.genre_gap,
    in_cannibal_pair: r.in_cannibal_pair,
  }));
  return {
    exportedAt: new Date().toISOString(),
    product: "Catalog Greenlight",
    intent: run.intent,
    model: run.model,
    fallback: Boolean(run.fallback),
    totalLatencyMs: run.totalLatencyMs,
    uniqueGenres: [...new Set(recommendations.map((r) => r.genre).filter(Boolean))],
    mcpQueryIds: [...MCP_QUERY_IDS],
    recommendations,
    sql: run.sql ?? null,
    attribution:
      "Ranking from ClickHouse via mcp-clickhouse + TypeScript GreenlightScorer — Gemini narrative only.",
  };
}

export function downloadJuryEvidence(run: AgentRunResult | null): boolean {
  const payload = juryEvidencePayload(run);
  if (!payload) return false;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadTextFile(
    JSON.stringify(payload, null, 2),
    `catalog-greenlight-jury-evidence-${stamp}.json`,
    "application/json;charset=utf-8",
  );
  return true;
}
