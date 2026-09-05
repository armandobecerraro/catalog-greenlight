/**
 * Client-side reimplementation of GreenlightScorer (scoreTitles + pickTopCandidates +
 * slateDecisionTrace). Keep in lockstep with packages/orchestration GreenlightScorer.ts.
 * Preview only — never writes production weights, never calls ClickHouse or Gemini.
 */
import { SCORER_WEIGHTS } from './greenlightMetrics';

export type ScorerWeights = {
  genre_gap: number;
  wow_momentum: number;
  cannibalization_penalty: number;
  language_gap: number;
};

export const SCORE_FROM_QUERIES = {
  genre_gap: 'A_genre_inventory',
  wow_momentum: 'B_title_momentum',
  cannibalization_penalty: 'C_cannibalization',
  language_gap: 'D_slate_holes'
} as const;

export const CANNIBAL_EXCLUDED_COPY =
  'If you greenlit both, they split the same audience.' as const;

export type WhyLost = 'lower_score' | 'diversity' | 'cannibal';

export interface TitleMomentumRow {
  title_id: string;
  title: string;
  genre: string;
  language: string;
  revenue_this_week: number;
  revenue_prior_week: number;
  wow_pct: number;
  views_this_week: number;
}

export interface GenreInventoryRow {
  genre: string;
  title_count: number;
  revenue_4w: number;
}

export interface CannibalizationRow {
  title_a: string;
  title_b: string;
  genre: string;
}

export interface SlateHoleRow {
  hole_type: string;
  dimension: string;
  gap_score: number;
}

export interface ScoredCandidate {
  title_id: string;
  title: string;
  genre: string;
  language: string;
  revenue_this_week: number;
  revenue_prior_week: number;
  wow_pct: number;
  genre_gap: number;
  wow_momentum: number;
  cannibalization_penalty: number;
  language_gap: number;
  opportunity_score: number;
  in_cannibal_pair: boolean;
}

export interface PickFlags {
  relaxCannibal?: boolean;
  relaxDiversity?: boolean;
  allowFiller?: boolean;
}

export interface RunnerUp {
  title: string;
  genre: string;
  opportunity_score: number;
  whyLost: WhyLost;
}

export interface CannibalExcluded {
  title: string;
  genre: string;
  opportunity_score: number;
  pair: { title_a: string; title_b: string; genre: string };
  copy: typeof CANNIBAL_EXCLUDED_COPY;
}

export interface SlateDecisionTrace {
  runnerUp?: RunnerUp;
  cannibalExcluded: CannibalExcluded[];
}

function num(row: Record<string, unknown>, key: string): number {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return parseFloat(v) || 0;
  return 0;
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? '' : String(v);
}

export function isSeedFillerTitle(title: string, description?: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/^Catalog Extra\b/i.test(t)) return true;
  if (description && /catalog title for demo seed|padding title/i.test(description)) return true;
  if (t.includes(':')) return false;
  const parts = t.split(/\s+/);
  const last = parts[parts.length - 1];
  return parts.length >= 3 && /^\d{1,3}$/.test(last);
}

export function isNearDuplicateTitle(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb || na === nb) return false;
  if (na.includes(nb) || nb.includes(na)) return true;
  let i = 0;
  while (i < na.length && i < nb.length && na[i] === nb[i]) i += 1;
  if (i >= 16) return true;
  const tokensA = na.split(/[\s:]+/).filter(t => t.length > 2).slice(0, 3).join(' ');
  const tokensB = nb.split(/[\s:]+/).filter(t => t.length > 2).slice(0, 3).join(' ');
  return tokensA.length >= 10 && tokensA === tokensB;
}

export function parseGenreInventory(rows: Record<string, unknown>[]): GenreInventoryRow[] {
  return rows.map(r => ({
    genre: str(r, 'genre'),
    title_count: num(r, 'title_count'),
    revenue_4w: num(r, 'revenue_4w')
  }));
}

export function parseTitleMomentum(rows: Record<string, unknown>[]): TitleMomentumRow[] {
  return rows
    .filter(r => Boolean(str(r, 'title').trim()))
    .map(r => ({
      title_id: str(r, 'title_id'),
      title: str(r, 'title'),
      genre: str(r, 'genre'),
      language: str(r, 'language') || 'en',
      revenue_this_week: num(r, 'revenue_this_week'),
      revenue_prior_week: num(r, 'revenue_prior_week'),
      wow_pct: num(r, 'wow_pct'),
      views_this_week: num(r, 'views_this_week')
    }));
}

export function parseCannibalization(rows: Record<string, unknown>[]): CannibalizationRow[] {
  return rows
    .map(r => ({
      title_a: str(r, 'title_a'),
      title_b: str(r, 'title_b'),
      genre: str(r, 'genre')
    }))
    .filter(p => p.title_a && p.title_b && isNearDuplicateTitle(p.title_a, p.title_b));
}

export function parseSlateHoles(rows: Record<string, unknown>[]): SlateHoleRow[] {
  return rows.map(r => ({
    hole_type: str(r, 'hole_type'),
    dimension: str(r, 'dimension'),
    gap_score: num(r, 'gap_score')
  }));
}

function buildGenreGapMap(inventory: GenreInventoryRow[]): Map<string, number> {
  const totalTitles = inventory.reduce((s, g) => s + g.title_count, 0) || 1;
  const totalRev = inventory.reduce((s, g) => s + g.revenue_4w, 0) || 1;
  const gaps = new Map<string, number>();
  for (const g of inventory) {
    const titleShare = g.title_count / totalTitles;
    const revShare = g.revenue_4w / totalRev;
    gaps.set(g.genre, revShare - titleShare);
  }
  const values = [...gaps.values()];
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min;
  for (const [genre, gap] of gaps) {
    gaps.set(genre, (gap - min) / span);
  }
  return gaps;
}

/** Same semantics as GreenlightScorer.buildLanguageGapMap — raw SQL gap_score, clamped ≥ 0. */
function buildLanguageGapMap(holes: SlateHoleRow[]): Map<string, number> {
  const langHoles = holes.filter(h => h.hole_type === 'language');
  const map = new Map<string, number>();
  for (const h of langHoles) {
    map.set(h.dimension, Math.max(0, h.gap_score));
  }
  return map;
}

function buildCannibalizedTitles(pairs: CannibalizationRow[]): Set<string> {
  const set = new Set<string>();
  for (const p of pairs) {
    set.add(p.title_a);
    set.add(p.title_b);
  }
  return set;
}

function normalizeWow(wow: number): number {
  const clamped = Math.max(-0.5, Math.min(1.5, wow));
  return (clamped + 0.5) / 2;
}

export function scoreTitles(
  momentum: TitleMomentumRow[],
  inventory: GenreInventoryRow[],
  cannibalPairs: CannibalizationRow[],
  slateHoles: SlateHoleRow[],
  weights: ScorerWeights = SCORER_WEIGHTS
): ScoredCandidate[] {
  const genreGaps = buildGenreGapMap(inventory);
  const languageGaps = buildLanguageGapMap(slateHoles);
  const cannibalized = buildCannibalizedTitles(cannibalPairs);

  return momentum.map(t => {
    const genre_gap = genreGaps.get(t.genre) ?? 0;
    const wow_momentum = normalizeWow(t.wow_pct);
    const cannibalization_penalty = cannibalized.has(t.title) ? 1 : 0;
    const language_gap = languageGaps.get(t.language) ?? 0;
    const opportunity_score =
      weights.genre_gap * genre_gap +
      weights.wow_momentum * wow_momentum -
      weights.cannibalization_penalty * cannibalization_penalty +
      weights.language_gap * language_gap;

    return {
      ...t,
      genre_gap,
      wow_momentum,
      cannibalization_penalty,
      language_gap,
      opportunity_score,
      in_cannibal_pair: cannibalized.has(t.title)
    };
  });
}

export function pickTopCandidates(
  scored: ScoredCandidate[],
  limit = 3,
  inventoryGenreCount?: number,
  options?: PickFlags
): ScoredCandidate[] {
  const sorted = [...scored]
    .filter(s => s.title.trim())
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const storyPool = sorted.filter(s => !isSeedFillerTitle(s.title));
  const uniqueGenres = new Set(sorted.map(s => s.genre));
  const enforceDiversity =
    options?.relaxDiversity === true
      ? false
      : (inventoryGenreCount ?? uniqueGenres.size) >= limit;
  const allowFiller = options?.allowFiller === true && storyPool.length < limit;
  const firstPassAllowsCannibal = options?.relaxCannibal === true;

  const picked: ScoredCandidate[] = [];
  const usedGenres = new Set<string>();
  const usedIds = new Set<string>();

  const pickFrom = (
    pool: ScoredCandidate[],
    opts: { allowCannibal: boolean; allowFiller: boolean; allowDuplicateGenre: boolean }
  ) => {
    for (const c of pool) {
      if (picked.length >= limit) break;
      if (usedIds.has(c.title_id)) continue;
      if (!opts.allowFiller && isSeedFillerTitle(c.title)) continue;
      if (!opts.allowCannibal && c.in_cannibal_pair) continue;
      if (enforceDiversity && !opts.allowDuplicateGenre && usedGenres.has(c.genre)) continue;
      picked.push(c);
      usedIds.add(c.title_id);
      usedGenres.add(c.genre);
    }
  };

  pickFrom(sorted, {
    allowCannibal: firstPassAllowsCannibal,
    allowFiller: false,
    allowDuplicateGenre: false
  });
  if (picked.length < limit) {
    pickFrom(sorted, { allowCannibal: true, allowFiller: false, allowDuplicateGenre: false });
  }
  if (picked.length < limit) {
    pickFrom(sorted, { allowCannibal: true, allowFiller: false, allowDuplicateGenre: true });
  }
  if (picked.length < limit && allowFiller) {
    pickFrom(sorted, { allowCannibal: false, allowFiller: true, allowDuplicateGenre: false });
  }
  if (picked.length < limit && allowFiller) {
    pickFrom(sorted, { allowCannibal: true, allowFiller: true, allowDuplicateGenre: true });
  }

  return picked.slice(0, limit);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pairForTitle(title: string, pairs: CannibalizationRow[]): CannibalizationRow | undefined {
  return pairs.find(p => p.title_a === title || p.title_b === title);
}

function firstPassCannibalSkips(
  scored: ScoredCandidate[],
  limit: number,
  inventoryGenreCount?: number,
  options?: PickFlags
): ScoredCandidate[] {
  if (options?.relaxCannibal) return [];

  const sorted = [...scored]
    .filter(s => s.title.trim())
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const uniqueGenres = new Set(sorted.map(s => s.genre));
  const enforceDiversity =
    options?.relaxDiversity === true
      ? false
      : (inventoryGenreCount ?? uniqueGenres.size) >= limit;
  const picked: ScoredCandidate[] = [];
  const usedGenres = new Set<string>();
  const usedIds = new Set<string>();
  const skipped: ScoredCandidate[] = [];

  for (const c of sorted) {
    if (usedIds.has(c.title_id)) continue;
    if (isSeedFillerTitle(c.title)) continue;
    if (c.in_cannibal_pair) {
      skipped.push(c);
      continue;
    }
    if (picked.length >= limit) continue;
    if (enforceDiversity && usedGenres.has(c.genre)) continue;
    picked.push(c);
    usedIds.add(c.title_id);
    usedGenres.add(c.genre);
  }
  return skipped;
}

function whyRunnerLost(
  runner: ScoredCandidate,
  top: ScoredCandidate[],
  skippedCannibals: ScoredCandidate[]
): WhyLost {
  const lowestPick = top[top.length - 1]?.opportunity_score ?? Number.NEGATIVE_INFINITY;
  const topGenres = new Set(top.map(t => t.genre));
  const skippedIds = new Set(skippedCannibals.map(s => s.title_id));

  if (skippedIds.has(runner.title_id) && runner.opportunity_score >= lowestPick) {
    return 'cannibal';
  }
  if (topGenres.has(runner.genre) && runner.opportunity_score > lowestPick) {
    return 'diversity';
  }
  if (runner.in_cannibal_pair && runner.opportunity_score > lowestPick) {
    return 'cannibal';
  }
  return 'lower_score';
}

export function slateDecisionTrace(
  scored: ScoredCandidate[],
  top: ScoredCandidate[],
  pairs: CannibalizationRow[],
  options?: PickFlags & { inventoryGenreCount?: number }
): SlateDecisionTrace {
  const skipped = firstPassCannibalSkips(scored, top.length || 3, options?.inventoryGenreCount, options);
  const seen = new Set<string>();
  const cannibalExcluded: CannibalExcluded[] = [];
  for (const c of skipped.sort((a, b) => b.opportunity_score - a.opportunity_score).slice(0, 6)) {
    if (seen.has(c.title_id)) continue;
    const pair = pairForTitle(c.title, pairs);
    if (!pair) continue;
    seen.add(c.title_id);
    cannibalExcluded.push({
      title: c.title,
      genre: c.genre,
      opportunity_score: round3(c.opportunity_score),
      pair: { title_a: pair.title_a, title_b: pair.title_b, genre: pair.genre },
      copy: CANNIBAL_EXCLUDED_COPY
    });
  }

  const topIds = new Set(top.map(t => t.title_id));
  const remaining = scored
    .filter(s => s.title.trim() && !topIds.has(s.title_id) && !isSeedFillerTitle(s.title))
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const runner = remaining[0];

  return {
    cannibalExcluded,
    runnerUp: runner
      ? {
          title: runner.title,
          genre: runner.genre,
          opportunity_score: round3(runner.opportunity_score),
          whyLost: whyRunnerLost(runner, top, skipped)
        }
      : undefined
  };
}

export interface RescoreOptions {
  weights?: ScorerWeights;
  relaxCannibal?: boolean;
  relaxDiversity?: boolean;
}

export function hasDiscoverRows(fullById: Record<string, Record<string, unknown>[]> | null | undefined): boolean {
  if (!fullById) return false;
  const momentum = fullById['B_title_momentum'];
  return Array.isArray(momentum) && momentum.length > 0;
}

export function rescoreFromDiscover(
  fullById: Record<string, Record<string, unknown>[]>,
  options?: RescoreOptions
) {
  const weights = options?.weights ?? SCORER_WEIGHTS;
  const inventory = parseGenreInventory(fullById['A_genre_inventory'] ?? []);
  const momentum = parseTitleMomentum(fullById['B_title_momentum'] ?? []);
  const cannibal = parseCannibalization(fullById['C_cannibalization'] ?? []);
  const holes = parseSlateHoles(fullById['D_slate_holes'] ?? []);
  const scored = scoreTitles(momentum, inventory, cannibal, holes, weights);
  const inventoryGenreCount = inventory.filter(g => g.genre && g.title_count > 0).length;
  const flags: PickFlags = {
    relaxCannibal: options?.relaxCannibal,
    relaxDiversity: options?.relaxDiversity
  };
  const top = pickTopCandidates(scored, 3, inventoryGenreCount, flags);
  const trace = slateDecisionTrace(scored, top, cannibal, { ...flags, inventoryGenreCount });
  return { scored, top, trace, weights };
}
