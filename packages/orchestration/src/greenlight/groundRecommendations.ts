import { GreenlightRecommendation } from '@bas/core';

export function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function candidateTitleSet(rows: Record<string, unknown>[]): Set<string> {
  return new Set(
    rows
      .map(r => (typeof r.title === 'string' ? normalizeTitle(r.title) : ''))
      .filter(Boolean)
  );
}

function num(row: Record<string, unknown>, key: string): number | undefined {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v !== '') return parseFloat(v);
  return undefined;
}

function bool(row: Record<string, unknown>, key: string): boolean | undefined {
  const v = row[key];
  if (typeof v === 'boolean') return v;
  return undefined;
}

export function buildFallbackEvidence(row: Record<string, unknown>): string {
  const score = num(row, 'opportunity_score');
  const wow = num(row, 'wow_pct');
  const gap = num(row, 'genre_gap');
  const cannibal = bool(row, 'in_cannibal_pair');
  return `opportunity_score=${score ?? 'n/a'}, wow_pct=${wow ?? 'n/a'}, genre_gap=${gap ?? 'n/a'}, in_cannibal_pair=${cannibal ?? false}`;
}

export function buildFallbackJustification(row: Record<string, unknown>): string {
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const score = num(row, 'opportunity_score');
  const wow = num(row, 'wow_pct');
  const gap = num(row, 'genre_gap');
  const wowLabel = wow == null ? 'n/a' : `${(wow * 100).toFixed(0)}% WoW`;
  const gapLabel = gap == null ? 'n/a' : `genre gap ${gap.toFixed(2)}`;
  const scoreLabel = score == null ? 'n/a' : score.toFixed(2);
  const name = title || 'This title';
  return `${name} scores ${scoreLabel} on the TypeScript formula (${gapLabel}, ${wowLabel}). Gemini narrative unavailable — ClickHouse measured these numbers.`;
}

function enrichFromRow(
  rec: GreenlightRecommendation,
  row: Record<string, unknown>
): GreenlightRecommendation {
  return {
    ...rec,
    title: String(row.title ?? rec.title),
    genre: String(row.genre ?? rec.genre),
    opportunity_score: num(row, 'opportunity_score') ?? rec.opportunity_score,
    wow_pct: num(row, 'wow_pct') ?? rec.wow_pct,
    genre_gap: num(row, 'genre_gap') ?? rec.genre_gap,
    in_cannibal_pair: bool(row, 'in_cannibal_pair') ?? rec.in_cannibal_pair
  };
}

export function recommendationsFromCandidateRows(
  candidateRows: Record<string, unknown>[]
): GreenlightRecommendation[] {
  return candidateRows
    .filter(row => typeof row.title === 'string' && row.title.trim())
    .slice(0, 3)
    .map(row => ({
      title: String(row.title),
      genre: String(row.genre ?? ''),
      justification: buildFallbackJustification(row),
      evidence: buildFallbackEvidence(row),
      opportunity_score: num(row, 'opportunity_score'),
      wow_pct: num(row, 'wow_pct'),
      genre_gap: num(row, 'genre_gap'),
      in_cannibal_pair: bool(row, 'in_cannibal_pair')
    }));
}

/** Ground Gemini picks to candidates; case-insensitive title match. Falls back to scorer rows. */
export function groundRecommendations(
  recommendations: GreenlightRecommendation[] | undefined,
  candidateRows: Record<string, unknown>[]
): { recommendations: GreenlightRecommendation[]; usedFallback: boolean } {
  if (!candidateRows.length) {
    return { recommendations: [], usedFallback: true };
  }

  const byTitle = new Map<string, Record<string, unknown>>();
  for (const row of candidateRows) {
    if (typeof row.title === 'string' && row.title.trim()) {
      byTitle.set(normalizeTitle(row.title), row);
    }
  }

  const grounded = (recommendations ?? [])
    .map(rec => {
      const row = byTitle.get(normalizeTitle(rec.title));
      return row ? enrichFromRow(rec, row) : null;
    })
    .filter((r): r is GreenlightRecommendation => r !== null);

  if (grounded.length === 0) {
    return {
      recommendations: recommendationsFromCandidateRows(candidateRows),
      usedFallback: true
    };
  }

  return { recommendations: grounded.slice(0, 3), usedFallback: false };
}
