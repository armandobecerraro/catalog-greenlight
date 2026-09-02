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
  slate: SlateRow[];
  contrafactualPairs: CannibalPair[];
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

export function buildWeeklySlateExport(greenlight: AgentRunResult): WeeklySlateExport {
  return {
    exportedAt: new Date().toISOString(),
    intent: greenlight.intent,
    model: greenlight.model,
    totalLatencyMs: greenlight.totalLatencyMs,
    answer: greenlight.answer,
    slate: buildSlateRows(greenlight),
    contrafactualPairs: extractCannibalPairs(greenlight.steps)
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
