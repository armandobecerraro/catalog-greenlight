import { AgentIntent, GreenlightRecommendation } from '@bas/core';
import {
  GREENLIGHT_QUERY_A_GENRE_INVENTORY,
  GREENLIGHT_QUERY_B_TITLE_MOMENTUM,
  GREENLIGHT_QUERY_D_SLATE_HOLES
} from '../greenlight/greenlightQueries';

export interface AskSqlFallbackPlan {
  sql: string;
  intent: AgentIntent;
  note: string;
  queryId: string;
}

export function isGeminiPlannerUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|RESOURCE_EXHAUSTED|quota|billing|prepayment|rate.?limit|UNAVAILABLE|high demand|credits exhausted|Gemini API|Gemini synthesis timed out/i.test(
    message
  );
}

const REVENUE_LAST_WEEK_SQL = `
SELECT
  mc.title AS title,
  mc.genre AS genre,
  tr.revenue_usd AS revenue_usd,
  tr.views AS views
FROM media_catalog.title_revenue AS tr
INNER JOIN media_catalog.media_content AS mc ON mc.id = tr.title_id
WHERE tr.week_start = (SELECT max(week_start) FROM media_catalog.title_revenue)
  AND mc.title != ''
  AND mc.title NOT LIKE 'Catalog Extra%'
ORDER BY tr.revenue_usd DESC
LIMIT 10
`.trim();

const SCIFI_SLOT_SQL = `
SELECT
  mc.title AS title,
  mc.genre AS genre,
  tr.revenue_usd AS revenue_this_week,
  tr.views AS views_this_week
FROM media_catalog.media_content AS mc
INNER JOIN media_catalog.title_revenue AS tr
  ON tr.title_id = mc.id
 AND tr.week_start = (SELECT max(week_start) FROM media_catalog.title_revenue)
WHERE mc.genre = 'Sci-Fi'
  AND mc.title != ''
  AND mc.title NOT LIKE 'Catalog Extra%'
ORDER BY tr.revenue_usd DESC
LIMIT 8
`.trim();

export function planSqlFallback(userPrompt: string): AskSqlFallbackPlan {
  const q = userPrompt.toLowerCase();

  if (
    /under-?represented|underserved|genre gap|slate hole|menos representado|hueco|sub-?represent/i.test(
      q
    )
  ) {
    return {
      sql: GREENLIGHT_QUERY_D_SLATE_HOLES,
      intent: 'catalog_qa',
      queryId: 'D_slate_holes',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — slate holes / genre gap'
    };
  }

  if (/sci-?fi|ciencia ficci[oó]n|late-?night|noche/i.test(q)) {
    return {
      sql: SCIFI_SLOT_SQL,
      intent: 'catalog_qa',
      queryId: 'sci_fi_slot',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — Sci-Fi slot inventory'
    };
  }

  if (/highest revenue|last week|ingresos|top title|mayor ingreso/i.test(q)) {
    return {
      sql: REVENUE_LAST_WEEK_SQL,
      intent: 'stats',
      queryId: 'revenue_last_week',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — latest week revenue'
    };
  }

  if (/wow|momentum|week-over-week|semana a semana/i.test(q)) {
    return {
      sql: GREENLIGHT_QUERY_B_TITLE_MOMENTUM,
      intent: 'stats',
      queryId: 'B_title_momentum',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — title momentum'
    };
  }

  return {
    sql: GREENLIGHT_QUERY_A_GENRE_INVENTORY,
    intent: 'catalog_qa',
    queryId: 'A_genre_inventory',
    note: 'Deterministic MCP SQL (Gemini planner unavailable) — genre inventory'
  };
}

function num(row: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  }
  return 0;
}

function str(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

export function synthesizeFromRows(
  userPrompt: string,
  rows: Record<string, unknown>[]
): { answer: string; recommendations: GreenlightRecommendation[] } {
  if (rows.length === 0) {
    return {
      answer:
        'ClickHouse returned 0 rows for this question (deterministic MCP path; Gemini writer unavailable).',
      recommendations: []
    };
  }

  const first = rows[0];
  const hasGap = 'gap_score' in first || 'hole_type' in first;
  const hasWow = 'wow_pct' in first;
  const hasRevenue = 'revenue_usd' in first || 'revenue_this_week' in first || 'revenue_4w' in first;
  const hasTitle = Boolean(str(first, 'title'));

  if (hasGap) {
    const genreRows = rows.filter(r => str(r, 'hole_type') === 'genre' || str(r, 'genre') || str(r, 'dimension'));
    const ranked = [...genreRows].sort((a, b) => num(b, 'gap_score') - num(a, 'gap_score'));
    const top = ranked[0];
    const dim = str(top, 'dimension', 'genre');
    const gap = num(top, 'gap_score');
    return {
      answer: `${dim || 'This genre'} is the most underserved slice: gap_score ${gap.toFixed(3)} (revenue share minus title share). Measured in ClickHouse via mcp-clickhouse.`,
      recommendations: ranked.slice(0, 3).map(r => ({
        title: str(r, 'dimension', 'genre') || 'genre',
        genre: str(r, 'dimension', 'genre'),
        justification: `gap_score ${num(r, 'gap_score').toFixed(3)} from query D_slate_holes`,
        evidence: `gap_score=${num(r, 'gap_score')}, title_share=${num(r, 'title_share')}, revenue_share=${num(r, 'revenue_share')}`
      }))
    };
  }

  if (hasWow && hasTitle) {
    const ranked = [...rows].sort((a, b) => num(b, 'wow_pct') - num(a, 'wow_pct'));
    const top = ranked[0];
    return {
      answer: `${str(top, 'title')} leads week-over-week momentum at ${(num(top, 'wow_pct') * 100).toFixed(1)}% WoW. Numbers from ClickHouse via mcp-clickhouse.`,
      recommendations: ranked.slice(0, 3).map(toTitleRec)
    };
  }

  if (hasTitle && hasRevenue) {
    const ranked = [...rows].sort(
      (a, b) => num(b, 'revenue_usd', 'revenue_this_week', 'revenue_4w') - num(a, 'revenue_usd', 'revenue_this_week', 'revenue_4w')
    );
    const top = ranked[0];
    const rev = num(top, 'revenue_usd', 'revenue_this_week', 'revenue_4w');
    return {
      answer: `${str(top, 'title')} is the top measured title ($${rev.toFixed(0)}). ClickHouse via mcp-clickhouse.`,
      recommendations: ranked.slice(0, 3).map(toTitleRec)
    };
  }

  if ('genre' in first && ('title_count' in first || 'cnt' in first)) {
    const ranked = [...rows].sort((a, b) => num(a, 'title_count', 'cnt') - num(b, 'title_count', 'cnt'));
    const thin = ranked[0];
    return {
      answer: `${str(thin, 'genre')} has the fewest titles (${num(thin, 'title_count', 'cnt')}). Inventory measured in ClickHouse via mcp-clickhouse.`,
      recommendations: []
    };
  }

  return {
    answer: `ClickHouse returned ${rows.length} row(s) for “${userPrompt.slice(0, 80)}”. Gemini writer unavailable — the table below is the evidence.`,
    recommendations: rows.filter(r => str(r, 'title')).slice(0, 3).map(toTitleRec)
  };
}

function toTitleRec(row: Record<string, unknown>): GreenlightRecommendation {
  const title = str(row, 'title');
  const genre = str(row, 'genre');
  const wow = num(row, 'wow_pct');
  const rev = num(row, 'revenue_usd', 'revenue_this_week', 'revenue_4w');
  const parts = [
    wow ? `wow_pct=${wow}` : '',
    rev ? `revenue=${rev}` : '',
    genre ? `genre=${genre}` : ''
  ].filter(Boolean);
  return {
    title,
    genre,
    justification: 'Measured ClickHouse row (deterministic MCP path).',
    evidence: parts.join(', ')
  };
}
