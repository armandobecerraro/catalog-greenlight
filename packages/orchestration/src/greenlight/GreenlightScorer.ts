/**
 * Deterministic greenlight scoring — TypeScript analyst, not Gemini.
 *
 * opportunity = 0.4 * genre_gap + 0.4 * wow_momentum - 0.2 * cannibalization_penalty + 0.05 * language_gap
 */

export interface GenreInventoryRow {
  genre: string;
  title_count: number;
  revenue_4w: number;
}

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

export const SCORER_WEIGHTS = {
  genre_gap: 0.4,
  wow_momentum: 0.4,
  cannibalization_penalty: 0.2,
  language_gap: 0.05
} as const;

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

export type GeminiStatus = 'explained' | 'skipped' | 'error';
export type WhyLost = 'lower_score' | 'diversity' | 'cannibal';

export interface ScoreBreakdown {
  genre_gap: number;
  wow_momentum: number;
  cannibalization_penalty: number;
  language_gap: number;
  opportunity_score: number;
  weights: ScorerWeights;
  fromQueries: typeof SCORE_FROM_QUERIES;
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

/** Seed-generator titles look like "Fading Line 75" — keep story titles with a colon. */
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

export function parseGenreInventory(rows: Record<string, unknown>[]): GenreInventoryRow[] {
  return rows.map(r => ({
    genre: str(r, 'genre'),
    title_count: num(r, 'title_count'),
    revenue_4w: num(r, 'revenue_4w')
  }));
}

export function parseTitleMomentum(rows: Record<string, unknown>[]): TitleMomentumRow[] {
  return rows
    .filter(r => {
      const title = str(r, 'title').trim();
      return Boolean(title);
    })
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

/** genre_gap: revenue share minus normalized title share (higher = underserved genre). */
export function buildGenreGapMap(inventory: GenreInventoryRow[]): Map<string, number> {
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

/**
 * language_gap must match D_slate_holes SQL semantics: revenue_share − title_share
 * for that language (clamped ≥ 0). Do NOT max-normalize — a 0.001 floor used to
 * inflate tiny holes (~0.0009) to ~0.9 and fail a ClickHouse re-derivation check.
 */
export function buildLanguageGapMap(holes: SlateHoleRow[]): Map<string, number> {
  const langHoles = holes.filter(h => h.hole_type === 'language');
  const map = new Map<string, number>();
  for (const h of langHoles) {
    map.set(h.dimension, Math.max(0, h.gap_score));
  }
  return map;
}

export function buildCannibalizedTitles(pairs: CannibalizationRow[]): Set<string> {
  const set = new Set<string>();
  for (const p of pairs) {
    set.add(p.title_a);
    set.add(p.title_b);
  }
  return set;
}

export function normalizeWow(wow: number): number {
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

export interface PickTopCandidatesOptions {
  /** When true, seed fillers may backfill only if fewer than `limit` story titles exist. */
  allowFiller?: boolean;
  /** Preview only: skip the first-pass cannibal exclusion. */
  relaxCannibal?: boolean;
  /** Preview only: do not enforce one-pick-per-genre. */
  relaxDiversity?: boolean;
}

/**
 * Prefer story titles and genre diversity. Relax diversity before admitting fillers.
 * Fillers never enter the slate when ≥`limit` story candidates exist (jury/demo path).
 */
export function pickTopCandidates(
  scored: ScoredCandidate[],
  limit = 3,
  inventoryGenreCount?: number,
  options?: PickTopCandidatesOptions
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
  const allowFiller =
    options?.allowFiller === true && storyPool.length < limit;
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

  // Story-first: diversity → cannibal OK → relax diversity
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
  // Filler only when explicitly opted in and the catalog lacks enough story titles
  if (picked.length < limit && allowFiller) {
    pickFrom(sorted, { allowCannibal: false, allowFiller: true, allowDuplicateGenre: false });
  }
  if (picked.length < limit && allowFiller) {
    pickFrom(sorted, {
      allowCannibal: true,
      allowFiller: true,
      allowDuplicateGenre: true
    });
  }

  return picked.slice(0, limit);
}

export function scoreBreakdownFor(
  c: ScoredCandidate,
  weights: ScorerWeights = SCORER_WEIGHTS
): ScoreBreakdown {
  return {
    genre_gap: c.genre_gap,
    wow_momentum: c.wow_momentum,
    cannibalization_penalty: c.cannibalization_penalty,
    language_gap: c.language_gap,
    opportunity_score: c.opportunity_score,
    weights: { ...weights },
    fromQueries: SCORE_FROM_QUERIES
  };
}

export function candidatesToQueryRows(
  candidates: ScoredCandidate[],
  weights: ScorerWeights = SCORER_WEIGHTS
): Record<string, unknown>[] {
  return candidates.map(c => ({
    title_id: c.title_id,
    title: c.title,
    genre: c.genre,
    language: c.language,
    revenue_this_week: c.revenue_this_week,
    revenue_prior_week: c.revenue_prior_week,
    wow_pct: Math.round(c.wow_pct * 1000) / 1000,
    genre_gap: Math.round(c.genre_gap * 1000) / 1000,
    wow_momentum: Math.round(c.wow_momentum * 1000) / 1000,
    cannibalization_penalty: c.cannibalization_penalty,
    language_gap: Math.round(c.language_gap * 1000) / 1000,
    opportunity_score: Math.round(c.opportunity_score * 1000) / 1000,
    in_cannibal_pair: c.in_cannibal_pair,
    scoreBreakdown: scoreBreakdownFor(c, weights)
  }));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function pairForTitle(
  title: string,
  pairs: CannibalizationRow[]
): CannibalizationRow | undefined {
  return pairs.find(p => p.title_a === title || p.title_b === title);
}

function firstPassCannibalSkips(
  scored: ScoredCandidate[],
  limit: number,
  inventoryGenreCount?: number,
  options?: PickTopCandidatesOptions
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

/**
 * Decision trace for the programming-chief cockpit.
 * cannibalExcluded = high-scoring titles skipped because in_cannibal_pair on the first pick pass.
 * runnerUp = best title not in the 3 picks.
 */
export function slateDecisionTrace(
  scored: ScoredCandidate[],
  top: ScoredCandidate[],
  pairs: CannibalizationRow[],
  options?: PickTopCandidatesOptions & { inventoryGenreCount?: number }
): SlateDecisionTrace {
  const skipped = firstPassCannibalSkips(
    scored,
    top.length || 3,
    options?.inventoryGenreCount,
    options
  );
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

export interface ScoreFromAnalyticsOptions {
  weights?: ScorerWeights;
  relaxCannibal?: boolean;
  relaxDiversity?: boolean;
  allowFiller?: boolean;
}

export function scoreFromAnalyticsById(
  byId: Record<string, Record<string, unknown>[]>,
  options?: ScoreFromAnalyticsOptions
) {
  const weights = options?.weights ?? SCORER_WEIGHTS;
  const inventory = parseGenreInventory(byId['A_genre_inventory'] ?? []);
  const momentum = parseTitleMomentum(byId['B_title_momentum'] ?? []);
  const cannibal = parseCannibalization(byId['C_cannibalization'] ?? []);
  const holes = parseSlateHoles(byId['D_slate_holes'] ?? []);
  const scored = scoreTitles(momentum, inventory, cannibal, holes, weights);
  const inventoryGenreCount = inventory.filter(g => g.genre && g.title_count > 0).length;
  const pickOpts: PickTopCandidatesOptions = {
    allowFiller: options?.allowFiller,
    relaxCannibal: options?.relaxCannibal,
    relaxDiversity: options?.relaxDiversity
  };
  const top = pickTopCandidates(scored, 3, inventoryGenreCount, pickOpts);
  const trace = slateDecisionTrace(scored, top, cannibal, {
    ...pickOpts,
    inventoryGenreCount
  });
  return {
    scored,
    top,
    candidateRows: candidatesToQueryRows(top, weights),
    trace
  };
}
