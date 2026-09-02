import { AgentRunResult } from '../api';
import { isNearDuplicateTitle, isSeedFillerTitle } from './greenlightMetrics';

const QUERY_IDS = {
  genreInventory: 'A_genre_inventory',
  titleMomentum: 'B_title_momentum',
  cannibalization: 'C_cannibalization',
  slateHoles: 'D_slate_holes'
} as const;

export interface GenreGapRow {
  genre: string;
  gapScore: number;
  titleShare: number;
  revenueShare: number;
  titleCount: number;
}

export interface MomentumHighlight {
  title: string;
  genre: string;
  wowPct: number;
}

export interface CannibalPair {
  titleA: string;
  titleB: string;
  genre: string;
  revenueA: number;
  revenueB: number;
}

export interface GreenlightAnalytics {
  genreGaps: GenreGapRow[];
  momentumHighlights: MomentumHighlight[];
  cannibalPairs: CannibalPair[];
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

function str(v: unknown): string {
  return v == null ? '' : String(v);
}

function discoverFullById(greenlight: AgentRunResult | null): Record<string, Record<string, unknown>[]> | null {
  const discover = greenlight?.steps?.find(s => s.step === 'DISCOVER');
  if (!discover?.output || typeof discover.output !== 'object') return null;
  const fullById = (discover.output as { fullById?: Record<string, unknown[]> }).fullById;
  if (!fullById) return null;
  return Object.fromEntries(
    Object.entries(fullById).map(([id, rows]) => [
      id,
      (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]
    ])
  );
}

/** Parse MCP analytics from the greenlight DISCOVER step (Option B — no API change). */
export function parseGreenlightAnalytics(greenlight: AgentRunResult | null): GreenlightAnalytics | null {
  const fullById = discoverFullById(greenlight);
  if (!fullById) return null;

  const inventoryByGenre = new Map<string, number>();
  for (const row of fullById[QUERY_IDS.genreInventory] ?? []) {
    inventoryByGenre.set(str(row.genre), num(row.title_count));
  }

  const genreGaps = (fullById[QUERY_IDS.slateHoles] ?? [])
    .filter(row => str(row.hole_type) === 'genre')
    .map(row => ({
      genre: str(row.dimension),
      gapScore: num(row.gap_score),
      titleShare: num(row.title_share),
      revenueShare: num(row.revenue_share),
      titleCount: inventoryByGenre.get(str(row.dimension)) ?? num(row.title_count)
    }))
    .sort((a, b) => b.gapScore - a.gapScore);

  const momentumHighlights = (fullById[QUERY_IDS.titleMomentum] ?? [])
    .map(row => ({
      title: str(row.title),
      genre: str(row.genre),
      wowPct: num(row.wow_pct)
    }))
    .filter(row => row.title && !isSeedFillerTitle(row.title) && Math.abs(row.wowPct) >= 0.01)
    .sort((a, b) => b.wowPct - a.wowPct)
    .slice(0, 5);

  const cannibalPairs = (fullById[QUERY_IDS.cannibalization] ?? [])
    .map(row => ({
      titleA: str(row.title_a),
      titleB: str(row.title_b),
      genre: str(row.genre),
      revenueA: num(row.revenue_a),
      revenueB: num(row.revenue_b)
    }))
    .filter(pair => pair.titleA && pair.titleB && isNearDuplicateTitle(pair.titleA, pair.titleB))
    .slice(0, 6);

  if (genreGaps.length === 0 && momentumHighlights.length === 0 && cannibalPairs.length === 0) {
    return null;
  }

  return { genreGaps, momentumHighlights, cannibalPairs };
}
