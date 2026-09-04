import { AgentIntent, GreenlightRecommendation } from '@bas/core';
import {
  GREENLIGHT_QUERY_A_GENRE_INVENTORY,
  GREENLIGHT_QUERY_B_TITLE_MOMENTUM,
  GREENLIGHT_QUERY_D_SLATE_HOLES,
  SQL_EXCLUDE_SEED_FILLER_TITLES
} from '../greenlight/greenlightQueries';

export interface AskSqlFallbackPlan {
  sql: string;
  intent: AgentIntent;
  note: string;
  queryId: string;
}

const CATALOG_GENRES: Array<{ id: string; re: RegExp }> = [
  { id: 'Sci-Fi', re: /sci-?fi|ciencia ficci[oó]n/i },
  { id: 'Documentary', re: /documentar/i },
  { id: 'Animation', re: /animation|animaci[oó]n/i },
  { id: 'Thriller', re: /thriller|suspenso/i },
  { id: 'Horror', re: /horror|terror/i },
  { id: 'Romance', re: /romance|rom[aá]ntic/i },
  { id: 'Action', re: /\baction\b|acci[oó]n/i },
  { id: 'Comedy', re: /\bcomed(?:y|ies)\b|comedia|feel-?good/i },
  { id: 'Drama', re: /\bdrama/i }
];

const MISSING_DURATION_COL = /\b(duration|runtime|runtime_minutes|length_minutes)\b/i;

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
  AND ${SQL_EXCLUDE_SEED_FILLER_TITLES}
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
  AND ${SQL_EXCLUDE_SEED_FILLER_TITLES}
ORDER BY tr.revenue_usd DESC
LIMIT 8
`.trim();

export function detectAskedGenre(userPrompt: string): string | null {
  for (const genre of CATALOG_GENRES) {
    if (genre.re.test(userPrompt)) return genre.id;
  }
  return null;
}

export function isSlateHoleBrief(userPrompt: string): boolean {
  return /under-?represented|underserved|genre gap|slate hole|menos representado|hueco|sub-?represent/i.test(
    userPrompt
  );
}

export function isRevenueGenreBrief(userPrompt: string): boolean {
  if (isSlateHoleBrief(userPrompt)) return false;
  const genre = detectAskedGenre(userPrompt);
  if (genre && wantsTitleList(userPrompt)) return false;
  return /greenlight next|should we greenlight|which genre should we|based on (recent )?revenue|recent revenue|g[eé]nero.+(greenlight|ingresos|revenue)|pr[oó]ximo g[eé]nero/i.test(
    userPrompt
  );
}

export function resolveAskIntent(classified: AgentIntent, userPrompt: string): AgentIntent {
  if (classified !== 'greenlight') return classified;
  if (isWeeklySlateAsk(userPrompt)) return 'greenlight';
  return 'catalog_qa';
}

function isWeeklySlateAsk(userPrompt: string): boolean {
  return /weekly (slate|picks|greenlight)|three picks|3 (picks|recommendations)|programming ritual|\brun greenlight\b/i.test(
    userPrompt
  );
}

function wantsTitleList(userPrompt: string): boolean {
  return !/how many|cu[aá]nt[oa]s|count\b|inventory|per genre|por g[eé]nero|distribution/i.test(userPrompt);
}

function asksDurationConstraint(userPrompt: string): boolean {
  return /under\s+\d|hours?\b|runtime|duration|minutos|\bhoras?\b/i.test(userPrompt);
}

function titlesQueryId(genre: string): string {
  return `titles_${genre.toLowerCase().replace(/[^a-z]+/g, '_')}`;
}

function titlesByGenreSql(genre: string): string {
  return `
SELECT
  mc.title AS title,
  mc.genre AS genre,
  mc.description AS description,
  tr.revenue_usd AS revenue_usd,
  tr.views AS views
FROM media_catalog.media_content AS mc
LEFT JOIN media_catalog.title_revenue AS tr
  ON tr.title_id = mc.id
 AND tr.week_start = (SELECT max(week_start) FROM media_catalog.title_revenue)
WHERE mc.genre = '${genre}'
  AND ${SQL_EXCLUDE_SEED_FILLER_TITLES}
ORDER BY coalesce(tr.revenue_usd, 0) DESC, mc.title ASC
LIMIT 12
`.trim();
}

export function planSqlFallback(userPrompt: string): AskSqlFallbackPlan {
  const q = userPrompt.toLowerCase();

  if (isSlateHoleBrief(userPrompt)) {
    return {
      sql: GREENLIGHT_QUERY_D_SLATE_HOLES,
      intent: 'catalog_qa',
      queryId: 'D_slate_holes',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — slate holes / genre gap'
    };
  }

  if (/sci-?fi|ciencia ficci[oó]n/i.test(q) && /late-?night|noche/i.test(q)) {
    return {
      sql: SCIFI_SLOT_SQL,
      intent: 'catalog_qa',
      queryId: 'sci_fi_slot',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — Sci-Fi slot inventory'
    };
  }

  const askedGenre = detectAskedGenre(userPrompt);
  if (askedGenre && wantsTitleList(userPrompt)) {
    return {
      sql: titlesByGenreSql(askedGenre),
      intent: 'catalog_qa',
      queryId: titlesQueryId(askedGenre),
      note: `Deterministic MCP SQL (Gemini planner unavailable) — ${askedGenre} titles (no duration column)`
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

  if (isRevenueGenreBrief(userPrompt)) {
    return {
      sql: GREENLIGHT_QUERY_D_SLATE_HOLES,
      intent: 'catalog_qa',
      queryId: 'D_slate_holes',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — genre vs recent revenue (gap_score)'
    };
  }

  if (/highest revenue|last week|top title|mayor ingreso|semana pasada/i.test(q)) {
    return {
      sql: REVENUE_LAST_WEEK_SQL,
      intent: 'stats',
      queryId: 'revenue_last_week',
      note: 'Deterministic MCP SQL (Gemini planner unavailable) — latest week revenue'
    };
  }

  return {
    sql: GREENLIGHT_QUERY_A_GENRE_INVENTORY,
    intent: 'catalog_qa',
    queryId: 'A_genre_inventory',
    note: 'Deterministic MCP SQL (Gemini planner unavailable) — genre inventory'
  };
}

function isGenreInventorySql(sql: string): boolean {
  return (
    /group by[\s\S]{0,80}genre/i.test(sql) &&
    /count\s*\(|title_count|\bcnt\b/i.test(sql) &&
    !/gap_score/i.test(sql)
  );
}

function sqlSelectsAskedGenreTitles(userPrompt: string, sql: string): boolean {
  const genre = detectAskedGenre(userPrompt);
  const sqlLower = sql.toLowerCase();
  if (!genre || !sqlLower.includes('title')) return false;
  if (!sqlLower.includes(genre.toLowerCase())) return false;
  if (isGenreInventorySql(sql)) return false;
  return true;
}

function sqlGroundsRevenueGenre(sql: string): boolean {
  if (/gap_score/i.test(sql)) return true;
  if (isGenreInventorySql(sql)) return false;
  return /revenue/i.test(sql) && /genre/i.test(sql);
}

function sqlUsesMissingDurationColumn(sql: string, schemaText: string): boolean {
  if (!MISSING_DURATION_COL.test(sql)) return false;
  return !MISSING_DURATION_COL.test(schemaText);
}

/**
 * If Gemini SQL ignores the brief (genre inventory for a comedy ask, invented duration
 * column, etc.), replace it with the deterministic MCP query for that brief.
 */
export function coerceGeneratedAskSql(
  userPrompt: string,
  generatedSql: string,
  schemaText = ''
): AskSqlFallbackPlan | null {
  const plan = planSqlFallback(userPrompt);
  if (sqlUsesMissingDurationColumn(generatedSql, schemaText)) {
    return plan;
  }
  const groundedTitles = sqlSelectsAskedGenreTitles(userPrompt, generatedSql);
  if (plan.queryId.startsWith('titles_')) {
    return groundedTitles ? null : plan;
  }
  if (isRevenueGenreBrief(userPrompt) && plan.queryId === 'D_slate_holes') {
    return sqlGroundsRevenueGenre(generatedSql) ? null : plan;
  }
  return null;
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

function durationHonesty(userPrompt: string): string {
  if (!asksDurationConstraint(userPrompt)) return '';
  return ' Runtime/duration is not a column on media_catalog.media_content, so titles are not filtered to under 2 hours.';
}

function moodHonesty(userPrompt: string): string {
  if (!/feel-?good/i.test(userPrompt)) return '';
  return ' Feel-good is not a catalog column; Comedy is the matching genre filter.';
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
  const askedGenre = detectAskedGenre(userPrompt);
  const notes = `${moodHonesty(userPrompt)}${durationHonesty(userPrompt)}`;

  const titleRows = rows.filter(r => str(r, 'title'));
  if (askedGenre && titleRows.length > 0) {
    const matching = titleRows.filter(r => {
      const genre = str(r, 'genre');
      return !genre || genre.toLowerCase() === askedGenre.toLowerCase();
    });
    if (matching.length === 0) {
      return {
        answer: `ClickHouse returned no ${askedGenre} titles for this question.${notes}`,
        recommendations: []
      };
    }
    const names = matching.slice(0, 3).map(r => str(r, 'title')).join(', ');
    return {
      answer: `Recommended ${askedGenre} titles from ClickHouse: ${names}.${notes} Measured via mcp-clickhouse.`,
      recommendations: matching.slice(0, 3).map(toTitleRec)
    };
  }

  if (hasGap) {
    const genreRows = rows.filter(r => {
      const hole = str(r, 'hole_type');
      if (hole === 'language') return false;
      return hole === 'genre' || Boolean(str(r, 'genre') || str(r, 'dimension'));
    });
    const ranked = [...genreRows].sort((a, b) => num(b, 'gap_score') - num(a, 'gap_score'));
    if (ranked.length === 0) {
      const langRows = rows.filter(r => str(r, 'hole_type') === 'language');
      if (langRows.length === 0) {
        return {
          answer: `ClickHouse returned ${rows.length} gap row(s) but no genre slice. Gemini writer unavailable — the table below is the evidence.`,
          recommendations: []
        };
      }
      const topLang = [...langRows].sort((a, b) => num(b, 'gap_score') - num(a, 'gap_score'))[0];
      const lang = str(topLang, 'dimension') || 'unknown';
      return {
        answer: `Language “${lang}” is the largest language gap (gap_score ${num(topLang, 'gap_score').toFixed(3)}). It is a language code, not a catalog genre. Measured in ClickHouse via mcp-clickhouse.`,
        recommendations: []
      };
    }
    const top = ranked[0];
    const dim = str(top, 'dimension', 'genre');
    const gap = num(top, 'gap_score');
    const lead = isRevenueGenreBrief(userPrompt)
      ? `${dim || 'This genre'} is the strongest next-genre pick from recent revenue vs inventory`
      : `${dim || 'This genre'} is the most underserved slice`;
    return {
      answer: `${lead}: gap_score ${gap.toFixed(3)} (revenue share minus title share). Measured in ClickHouse via mcp-clickhouse.`,
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
      (a, b) =>
        num(b, 'revenue_usd', 'revenue_this_week', 'revenue_4w') -
        num(a, 'revenue_usd', 'revenue_this_week', 'revenue_4w')
    );
    const top = ranked[0];
    const rev = num(top, 'revenue_usd', 'revenue_this_week', 'revenue_4w');
    return {
      answer: `${str(top, 'title')} is the top measured title ($${rev.toFixed(0)}). ClickHouse via mcp-clickhouse.`,
      recommendations: ranked.slice(0, 3).map(toTitleRec)
    };
  }

  if ('genre' in first && ('title_count' in first || 'cnt' in first)) {
    if (isRevenueGenreBrief(userPrompt)) {
      const ranked = [...rows].sort(
        (a, b) => num(b, 'revenue_4w', 'revenue_usd') - num(a, 'revenue_4w', 'revenue_usd')
      );
      const top = ranked[0];
      const genre = str(top, 'genre');
      const rev = num(top, 'revenue_4w', 'revenue_usd');
      return {
        answer: `${genre} led recent measured revenue ($${rev.toFixed(0)} across ${num(top, 'title_count', 'cnt')} titles). Grounded in ClickHouse via mcp-clickhouse — not the thinnest inventory slice.`,
        recommendations: ranked.slice(0, 3).map(r => ({
          title: str(r, 'genre') || 'genre',
          genre: str(r, 'genre'),
          justification: `recent revenue ${num(r, 'revenue_4w', 'revenue_usd')}`,
          evidence: `title_count=${num(r, 'title_count', 'cnt')}, revenue=${num(r, 'revenue_4w', 'revenue_usd')}`
        }))
      };
    }

    if (askedGenre) {
      const row = rows.find(r => str(r, 'genre').toLowerCase() === askedGenre.toLowerCase());
      if (!row) {
        return {
          answer: `ClickHouse inventory rows had no ${askedGenre} slice.${notes}`,
          recommendations: []
        };
      }
      return {
        answer: `${askedGenre} has ${num(row, 'title_count', 'cnt')} titles in catalog.${notes} Measured in ClickHouse via mcp-clickhouse.`,
        recommendations: []
      };
    }

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
