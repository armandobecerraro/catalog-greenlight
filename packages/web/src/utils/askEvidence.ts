import type { AgentRunResult } from '../api';

/** True when the ask run returned live ClickHouse proof (SQL and/or rows). */
export function hasClickHouseEvidence(run: Pick<AgentRunResult, 'sql' | 'queryRows' | 'answer'>): boolean {
  if (typeof run.sql === 'string' && run.sql.trim().length > 0) return true;
  if (Array.isArray(run.queryRows) && run.queryRows.length > 0) return true;
  if (typeof run.answer === 'string' && /gap_score/i.test(run.answer)) return true;
  return false;
}

/** Best-effort highlight from live ClickHouse gap_score rows (genre can move after ingest). */
export function gapScoreHighlight(
  run: Pick<AgentRunResult, 'answer' | 'queryRows'>
): string | null {
  const rows = run.queryRows;
  if (Array.isArray(rows) && rows.length > 0) {
    const scored = rows
      .map(r => {
        const row = r as Record<string, unknown>;
        const raw = row.gap_score;
        const gap = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(gap)) return null;
        const dim =
          (typeof row.dimension === 'string' && row.dimension) ||
          (typeof row.genre === 'string' && row.genre) ||
          null;
        return { dim, gap };
      })
      .filter((x): x is { dim: string | null; gap: number } => x != null)
      .sort((a, b) => b.gap - a.gap);
    if (scored[0]) {
      const label = scored[0].dim ? `${scored[0].dim}: ` : '';
      return `${label}gap_score ${scored[0].gap.toFixed(3)}`;
    }
  }
  const m = typeof run.answer === 'string' ? run.answer.match(/gap_score\s+([\d.]+)/i) : null;
  if (m) return `gap_score ${m[1]}`;
  return null;
}
