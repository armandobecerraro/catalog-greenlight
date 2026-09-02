/**
 * Deterministic greenlight scoring — TypeScript analyst, not Gemini.
 *
 * opportunity = 0.4 * genre_gap + 0.4 * wow_momentum - 0.2 * cannibalization_penalty
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
  cannibalization_penalty: 0.2
} as const;

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
    .filter(r => str(r, 'title').trim() && !str(r, 'title').startsWith('Catalog Extra'))
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
  const span = max - min || 1;
  for (const [genre, gap] of gaps) {
    gaps.set(genre, (gap - min) / span);
  }
  return gaps;
}

export function buildLanguageGapMap(holes: SlateHoleRow[]): Map<string, number> {
  const langHoles = holes.filter(h => h.hole_type === 'language');
  const maxGap = Math.max(...langHoles.map(h => h.gap_score), 0.001);
  const map = new Map<string, number>();
  for (const h of langHoles) {
    map.set(h.dimension, Math.max(0, h.gap_score) / maxGap);
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
  slateHoles: SlateHoleRow[]
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
      SCORER_WEIGHTS.genre_gap * genre_gap +
      SCORER_WEIGHTS.wow_momentum * wow_momentum -
      SCORER_WEIGHTS.cannibalization_penalty * cannibalization_penalty +
      0.05 * language_gap;

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

/** At most one title per genre unless fewer than 3 genres in candidates. */
export function pickTopCandidates(
  scored: ScoredCandidate[],
  limit = 3
): ScoredCandidate[] {
  const sorted = [...scored]
    .filter(s => s.title.trim())
    .sort((a, b) => b.opportunity_score - a.opportunity_score);
  const uniqueGenres = new Set(sorted.map(s => s.genre));
  const enforceDiversity = uniqueGenres.size >= limit;

  const picked: ScoredCandidate[] = [];
  const usedGenres = new Set<string>();

  for (const c of sorted) {
    if (picked.length >= limit) break;
    if (enforceDiversity && usedGenres.has(c.genre)) continue;
    if (c.in_cannibal_pair) continue;
    picked.push(c);
    usedGenres.add(c.genre);
  }

  if (picked.length < limit) {
    for (const c of sorted) {
      if (picked.length >= limit) break;
      if (picked.some(p => p.title_id === c.title_id)) continue;
      if (c.in_cannibal_pair) continue;
      if (enforceDiversity && usedGenres.has(c.genre)) continue;
      picked.push(c);
      usedGenres.add(c.genre);
    }
  }

  if (picked.length < limit) {
    for (const c of sorted) {
      if (picked.length >= limit) break;
      if (picked.some(p => p.title_id === c.title_id)) continue;
      picked.push(c);
    }
  }

  return picked.slice(0, limit);
}

export function candidatesToQueryRows(candidates: ScoredCandidate[]): Record<string, unknown>[] {
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
    opportunity_score: Math.round(c.opportunity_score * 1000) / 1000,
    in_cannibal_pair: c.in_cannibal_pair
  }));
}

export function scoreFromAnalyticsById(byId: Record<string, Record<string, unknown>[]>) {
  const inventory = parseGenreInventory(byId['A_genre_inventory'] ?? []);
  const momentum = parseTitleMomentum(byId['B_title_momentum'] ?? []);
  const cannibal = parseCannibalization(byId['C_cannibalization'] ?? []);
  const holes = parseSlateHoles(byId['D_slate_holes'] ?? []);
  const scored = scoreTitles(momentum, inventory, cannibal, holes);
  const top = pickTopCandidates(scored, 3);
  return { scored, top, candidateRows: candidatesToQueryRows(top) };
}
