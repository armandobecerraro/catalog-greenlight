import type { AgentStep, Recommendation } from '../api';

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Mirrors @bas/orchestration SCORER_WEIGHTS — keep in sync with GreenlightScorer.ts */
export const SCORER_WEIGHTS = {
  genre_gap: 0.4,
  wow_momentum: 0.4,
  cannibalization_penalty: 0.2
} as const;

export function scorerFormulaText(): string {
  return `opportunity = ${SCORER_WEIGHTS.genre_gap}*genre_gap + ${SCORER_WEIGHTS.wow_momentum}*wow_momentum - ${SCORER_WEIGHTS.cannibalization_penalty}*cannibalization_penalty`;
}

export interface RecMetrics {
  opportunity_score?: number;
  wow_pct?: number;
  genre_gap?: number;
  wow_momentum?: number;
  cannibalization_penalty?: number;
  in_cannibal_pair?: boolean;
}

export function metricsForRec(rec: Recommendation, queryRows: Record<string, unknown>[]): RecMetrics {
  const fromRec: RecMetrics = {
    opportunity_score: rec.opportunity_score,
    wow_pct: rec.wow_pct,
    genre_gap: rec.genre_gap,
    in_cannibal_pair: rec.in_cannibal_pair,
    cannibalization_penalty: rec.in_cannibal_pair ? 1 : 0
  };
  const row = queryRows.find(
    r => typeof r.title === 'string' && normalizeTitle(String(r.title)) === normalizeTitle(rec.title)
  );
  if (!row) return fromRec;

  const cannibalPenalty = num(row, 'cannibalization_penalty');
  const inPair = bool(row, 'in_cannibal_pair');

  return {
    opportunity_score: fromRec.opportunity_score ?? num(row, 'opportunity_score'),
    wow_pct: fromRec.wow_pct ?? num(row, 'wow_pct'),
    genre_gap: fromRec.genre_gap ?? num(row, 'genre_gap'),
    wow_momentum: num(row, 'wow_momentum'),
    cannibalization_penalty:
      cannibalPenalty ?? ((inPair ?? fromRec.in_cannibal_pair) ? 1 : 0),
    in_cannibal_pair: fromRec.in_cannibal_pair ?? inPair
  };
}

function num(row: Record<string, unknown>, key: string): number | undefined {
  const v = row[key];
  return typeof v === 'number' ? v : undefined;
}

function bool(row: Record<string, unknown>, key: string): boolean | undefined {
  const v = row[key];
  return typeof v === 'boolean' ? v : undefined;
}

export function formatPct(value: number | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

export interface CannibalPair {
  title_a: string;
  title_b: string;
  genre: string;
}

export function extractCannibalPairs(steps: AgentStep[]): CannibalPair[] {
  const discover = steps.find(s => s.step === 'DISCOVER');
  if (!discover?.output || typeof discover.output !== 'object') return [];

  const output = discover.output as {
    queries?: Array<{ id: string; rows?: Record<string, unknown>[] }>;
  };
  const query = output.queries?.find(q => q.id === 'C_cannibalization');
  if (!query?.rows?.length) return [];

  return query.rows
    .map(r => ({
      title_a: String(r.title_a ?? ''),
      title_b: String(r.title_b ?? ''),
      genre: String(r.genre ?? '')
    }))
    .filter(p => p.title_a && p.title_b);
}
