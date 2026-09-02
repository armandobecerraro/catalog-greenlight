import type { AgentRunResult, CatalogStats, Recommendation } from '../api';
import { topCandidatesFromSteps } from './greenlightUx';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface WeekSignals {
  bullets: string[];
  impact: string;
  partial: boolean;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(r => r && typeof r === 'object') as Record<string, unknown>[];
}

function num(row: Record<string, unknown>, key: string): number | undefined {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return v == null ? '' : String(v);
}

function greenlightQueryRows(greenlight: AgentRunResult | null, queryId: string): Record<string, unknown>[] {
  const discover = greenlight?.steps?.find(s => s.step === 'DISCOVER');
  const output = discover?.output as { queries?: Array<{ id: string; rows?: unknown[] }> } | undefined;
  const q = output?.queries?.find(x => x.id === queryId);
  return asRows(q?.rows);
}

function allCandidates(greenlight: AgentRunResult | null): Recommendation[] {
  const recs = greenlight?.recommendations ?? [];
  if (recs.length > 0) return recs;
  const fromSteps = topCandidatesFromSteps(greenlight);
  if (fromSteps.length > 0) return fromSteps;
  return asRows(greenlight?.queryRows).map(r => ({
    title: str(r, 'title'),
    genre: str(r, 'genre'),
    justification: '',
    evidence: '',
    opportunity_score: num(r, 'opportunity_score'),
    wow_pct: num(r, 'wow_pct'),
    genre_gap: num(r, 'genre_gap'),
    in_cannibal_pair: Boolean(r.in_cannibal_pair)
  }));
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0';
  return ((part / total) * 100).toFixed(0);
}

function formatWow(wow: number | undefined): string {
  if (wow == null) return '—';
  const sign = wow > 0 ? '+' : '';
  return `${sign}${(wow * 100).toFixed(0)}%`;
}

function comedyBullet(
  stats: CatalogStats | null,
  greenlight: AgentRunResult | null,
  greenlightLoading: boolean,
  t: TranslateFn
): string {
  if (!greenlightLoading && greenlight) {
    const inventory = greenlightQueryRows(greenlight, 'A_genre_inventory');
    const comedy = inventory.find(r => str(r, 'genre') === 'Comedy');
    if (comedy) {
      const totalTitles = inventory.reduce((s, r) => s + (num(r, 'title_count') ?? 0), 0);
      const totalRev = inventory.reduce((s, r) => s + (num(r, 'revenue_4w') ?? 0), 0);
      const count = num(comedy, 'title_count') ?? 0;
      const rev = num(comedy, 'revenue_4w') ?? 0;
      return t('dashboard.signals.loaded.comedy', {
        count,
        titlePct: pct(count, totalTitles),
        revPct: pct(rev, totalRev)
      });
    }
  }
  if (stats?.genres?.Comedy != null) {
    const count = stats.genres.Comedy;
    const total = Object.values(stats.genres).reduce((a, b) => a + b, 0);
    return t('dashboard.signals.loaded.comedyStatsOnly', { count, titlePct: pct(count, total) });
  }
  return t('dashboard.signals.loading.comedy');
}

function thrillerBullet(
  stats: CatalogStats | null,
  greenlight: AgentRunResult | null,
  greenlightLoading: boolean,
  t: TranslateFn
): string {
  if (!greenlightLoading && greenlight) {
    const holes = greenlightQueryRows(greenlight, 'D_slate_holes');
    const thrillerHole = holes.find(
      r => str(r, 'hole_type') === 'genre' && str(r, 'dimension') === 'Thriller'
    );
    if (thrillerHole) {
      const gap = num(thrillerHole, 'gap_score');
      if (gap != null) {
        return t('dashboard.signals.loaded.thrillerGap', { gap: gap.toFixed(2) });
      }
    }
    const inventory = greenlightQueryRows(greenlight, 'A_genre_inventory');
    const thriller = inventory.find(r => str(r, 'genre') === 'Thriller');
    const comedy = inventory.find(r => str(r, 'genre') === 'Comedy');
    if (thriller && comedy) {
      return t('dashboard.signals.loaded.thrillerInventory', {
        thrillerCount: num(thriller, 'title_count') ?? 0,
        comedyCount: num(comedy, 'title_count') ?? 0
      });
    }
  }
  if (stats?.genres) {
    const thrillerCount = stats.genres.Thriller ?? 0;
    const comedyCount = stats.genres.Comedy ?? 0;
    if (thrillerCount > 0 || comedyCount > 0) {
      return t('dashboard.signals.loaded.thrillerInventory', { thrillerCount, comedyCount });
    }
  }
  return t('dashboard.signals.loading.thriller');
}

function cannibalBullet(
  greenlight: AgentRunResult | null,
  greenlightLoading: boolean,
  t: TranslateFn
): string {
  if (!greenlightLoading && greenlight) {
    const pairs = greenlightQueryRows(greenlight, 'C_cannibalization');
    const pair = pairs[0];
    if (pair) {
      return t('dashboard.signals.loaded.cannibal', {
        titleA: str(pair, 'title_a'),
        titleB: str(pair, 'title_b')
      });
    }
    const flagged = allCandidates(greenlight).find(c => c.in_cannibal_pair);
    if (flagged) {
      return t('dashboard.signals.loaded.cannibalSingle', { title: flagged.title });
    }
  }
  return t('dashboard.signals.loading.cannibal');
}

function breakoutBullet(
  greenlight: AgentRunResult | null,
  greenlightLoading: boolean,
  t: TranslateFn
): string {
  if (!greenlightLoading && greenlight) {
    const momentum = greenlightQueryRows(greenlight, 'B_title_momentum');
    const latamRows = momentum.filter(r => str(r, 'language') === 'es');
    const pool = latamRows.length > 0 ? latamRows : momentum;
    const best = pool.reduce<Record<string, unknown> | null>((top, row) => {
      const wow = num(row, 'wow_pct');
      if (wow == null) return top;
      if (!top || wow > (num(top, 'wow_pct') ?? -Infinity)) return row;
      return top;
    }, null);
    if (best) {
      return t('dashboard.signals.loaded.breakout', {
        title: str(best, 'title'),
        wow: formatWow(num(best, 'wow_pct')),
        genre: str(best, 'genre')
      });
    }
    const topRec = allCandidates(greenlight)[0];
    if (topRec?.title) {
      return t('dashboard.signals.loaded.breakoutPick', {
        title: topRec.title,
        wow: formatWow(topRec.wow_pct),
        score: topRec.opportunity_score?.toFixed(3) ?? '—'
      });
    }
  }
  return t('dashboard.signals.loading.breakout');
}

export function buildWeekSignals(
  stats: CatalogStats | null,
  greenlight: AgentRunResult | null,
  statsLoading: boolean,
  greenlightLoading: boolean,
  t: TranslateFn
): WeekSignals {
  const partial = statsLoading || greenlightLoading;
  const bullets = [
    comedyBullet(stats, greenlight, greenlightLoading, t),
    thrillerBullet(stats, greenlight, greenlightLoading, t),
    cannibalBullet(greenlight, greenlightLoading, t),
    breakoutBullet(greenlight, greenlightLoading, t)
  ];

  return {
    bullets,
    impact: t('dashboard.signals.impact'),
    partial
  };
}
