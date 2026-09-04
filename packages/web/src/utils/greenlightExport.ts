import type { AgentRunResult, Recommendation } from '../api';
import {
  CannibalPair,
  extractCannibalPairs,
  metricsForRec,
  normalizeTitle
} from './greenlightMetrics';

export interface SlateRow {
  rank: number;
  title: string;
  genre: string;
  opportunity_score: number | null;
  wow_pct: number | null;
  genre_gap: number | null;
  in_cannibal_pair: boolean;
  justification: string;
  evidence: string;
}

export interface WeeklySlateExport {
  exportedAt: string;
  intent: string;
  model: string;
  totalLatencyMs: number;
  answer: string;
  memoSource: 'gemini' | 'template';
  slate: SlateRow[];
  contrafactualPairs: CannibalPair[];
  cannibalExcluded: AgentRunResult['cannibalExcluded'];
}

function buildSlateRows(greenlight: AgentRunResult): SlateRow[] {
  const queryRows = (greenlight.queryRows ?? []) as Record<string, unknown>[];
  const recommendations = greenlight.recommendations ?? [];

  return recommendations.map((rec, i) => {
    const metrics = metricsForRec(rec, queryRows);
    return {
      rank: i + 1,
      title: rec.title,
      genre: rec.genre,
      opportunity_score: metrics.opportunity_score ?? null,
      wow_pct: metrics.wow_pct ?? null,
      genre_gap: metrics.genre_gap ?? null,
      in_cannibal_pair: metrics.in_cannibal_pair ?? false,
      justification: rec.justification,
      evidence: rec.evidence
    };
  });
}

export function programmingMemo(greenlight: AgentRunResult): {
  text: string;
  source: 'gemini' | 'template';
} {
  const answer = greenlight.answer?.trim();
  const genericFallback = /Gemini memo is optional/i.test(answer ?? '');
  if (!answer || greenlight.fallback || genericFallback) {
    return { text: buildDeterministicMemo(greenlight), source: 'template' };
  }
  return { text: answer, source: 'gemini' };
}

export function buildDeterministicMemo(greenlight: AgentRunResult): string {
  const rows = buildSlateRows(greenlight);
  const lines = rows.map(r => {
    const score = r.opportunity_score != null ? r.opportunity_score.toFixed(3) : 'n/a';
    const gap = r.genre_gap != null ? r.genre_gap.toFixed(3) : 'n/a';
    const wow = r.wow_pct != null ? `${(r.wow_pct * 100).toFixed(1)}%` : 'n/a';
    return `${r.rank}. ${r.title} (${r.genre}) — score ${score}, genre_gap ${gap}, wow ${wow}`;
  });
  const excluded = greenlight.cannibalExcluded ?? [];
  const cannibalLine =
    excluded.length > 0
      ? `Cannibal exclusions: ${excluded.map(e => e.title).join(', ')}. If you greenlit both, they split the same audience.`
      : 'ClickHouse found no near-duplicate conflict this week.';
  return [
    'Weekly catalog slate from ClickHouse measurements and the published TypeScript scorer. Gemini did not pick these titles.',
    ...lines,
    cannibalLine
  ].join('\n');
}

export function gapFilledFromRun(greenlight: AgentRunResult): { label: string; available: boolean } {
  const discover = greenlight.steps?.find(s => s.step === 'DISCOVER');
  const output = discover?.output as {
    fullById?: Record<string, Record<string, unknown>[]>;
    queries?: Array<{ id: string; rows?: Record<string, unknown>[] }>;
  } | undefined;
  const rows =
    output?.fullById?.D_slate_holes ??
    output?.queries?.find(q => q.id === 'D_slate_holes')?.rows ??
    [];
  const genreRows = rows
    .filter(r => String(r.hole_type ?? 'genre') !== 'language')
    .map(r => ({
      dim: String(r.dimension ?? r.genre ?? ''),
      gap: typeof r.gap_score === 'number' ? r.gap_score : Number(r.gap_score)
    }))
    .filter(r => r.dim && Number.isFinite(r.gap))
    .sort((a, b) => b.gap - a.gap);
  if (genreRows[0]) {
    return {
      label: `${genreRows[0].dim} gap_score ${genreRows[0].gap.toFixed(3)} (live ClickHouse; genre can move after ingest)`,
      available: true
    };
  }
  return { label: 'unavailable', available: false };
}

export function buildWeeklySlateExport(greenlight: AgentRunResult): WeeklySlateExport {
  const memo = programmingMemo(greenlight);
  return {
    exportedAt: new Date().toISOString(),
    intent: greenlight.intent,
    model: greenlight.model,
    totalLatencyMs: greenlight.totalLatencyMs,
    answer: memo.text,
    memoSource: memo.source,
    slate: buildSlateRows(greenlight),
    contrafactualPairs: extractCannibalPairs(greenlight.steps),
    cannibalExcluded: greenlight.cannibalExcluded ?? []
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNum(value: number | null, digits = 3): string {
  return value == null ? '' : value.toFixed(digits);
}

export function weeklySlateToCsv(greenlight: AgentRunResult): string {
  const exportData = buildWeeklySlateExport(greenlight);
  const header = [
    'rank',
    'title',
    'genre',
    'opportunity_score',
    'wow_pct',
    'genre_gap',
    'in_cannibal_pair',
    'justification',
    'evidence'
  ].join(',');

  const rows = exportData.slate.map(row =>
    [
      row.rank,
      csvEscape(row.title),
      csvEscape(row.genre),
      formatNum(row.opportunity_score),
      formatNum(row.wow_pct),
      formatNum(row.genre_gap),
      row.in_cannibal_pair ? 'true' : 'false',
      csvEscape(row.justification),
      csvEscape(row.evidence)
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

export function weeklySlateToJson(greenlight: AgentRunResult): string {
  return JSON.stringify(buildWeeklySlateExport(greenlight), null, 2);
}

export function downloadTextFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportWeeklySlate(greenlight: AgentRunResult, format: 'csv' | 'json'): void {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    downloadTextFile(
      weeklySlateToCsv(greenlight),
      `greenlight-slate-${stamp}.csv`,
      'text/csv;charset=utf-8'
    );
  } else {
    downloadTextFile(
      weeklySlateToJson(greenlight),
      `greenlight-slate-${stamp}.json`,
      'application/json;charset=utf-8'
    );
  }
}

/** Pairs whose titles are not in the current slate picks (excluded contrafactual). */
export function contrafactualPairs(
  pairs: CannibalPair[],
  recommendations: Recommendation[]
): CannibalPair[] {
  const picked = new Set(recommendations.map(r => normalizeTitle(r.title)));
  return pairs.filter(
    p =>
      !picked.has(normalizeTitle(p.title_a)) &&
      !picked.has(normalizeTitle(p.title_b))
  );
}
