/** Deterministic SELECT queries for weekly greenlight analysis (no Gemini SQL). */

/**
 * Title filters aligned with `isSeedFillerTitle` (title-only rules):
 * Catalog Extra*, Scorer pick:*, and "Word Word N" / "Chronicle of Dream N" without a colon.
 * Story titles with a colon (e.g. Archive: Road 114) are kept.
 */
export const SQL_EXCLUDE_SEED_FILLER_TITLES = `
  mc.title != ''
  AND mc.title NOT LIKE 'Catalog Extra%'
  AND mc.title NOT LIKE 'Scorer pick:%'
  AND NOT (
    positionUTF8(mc.title, ':') = 0
    AND match(mc.title, '^([^ ]+ ){2,}[0-9]{1,3}$')
  )
`.trim();

export const GREENLIGHT_QUERY_A_GENRE_INVENTORY = `
SELECT
  mc.genre AS genre,
  count(DISTINCT mc.id) AS title_count,
  coalesce(sum(tr.revenue_usd), 0) AS revenue_4w
FROM media_catalog.media_content AS mc
LEFT JOIN media_catalog.title_revenue AS tr
  ON mc.id = tr.title_id
  AND tr.week_start >= (
    SELECT max(week_start) - 21 FROM media_catalog.title_revenue
  )
GROUP BY mc.genre
ORDER BY revenue_4w DESC
`.trim();

export const GREENLIGHT_QUERY_B_TITLE_MOMENTUM = `
SELECT
  mc.id AS title_id,
  mc.title AS title,
  mc.genre AS genre,
  mc.language AS language,
  tw.revenue_usd AS revenue_this_week,
  coalesce(pw.revenue_usd, 0) AS revenue_prior_week,
  if(
    coalesce(pw.revenue_usd, 0) = 0,
    if(tw.revenue_usd > 0, toFloat64(1), toFloat64(0)),
    (tw.revenue_usd - pw.revenue_usd) / pw.revenue_usd
  ) AS wow_pct,
  tw.views AS views_this_week
FROM media_catalog.media_content AS mc
INNER JOIN media_catalog.title_revenue AS tw
  ON tw.title_id = mc.id
 AND tw.week_start = (SELECT max(week_start) FROM media_catalog.title_revenue)
LEFT JOIN media_catalog.title_revenue AS pw
  ON pw.title_id = mc.id
 AND pw.week_start = (SELECT max(week_start) - 7 FROM media_catalog.title_revenue)
WHERE ${SQL_EXCLUDE_SEED_FILLER_TITLES}
ORDER BY wow_pct DESC
`.trim();

export const GREENLIGHT_QUERY_C_CANNIBALIZATION = `
WITH latest AS (
  SELECT max(week_start) AS w FROM media_catalog.title_revenue
),
title_rev AS (
  SELECT
    tr.title_id,
    any(tr.title) AS title,
    mc.genre AS genre,
    sum(tr.revenue_usd) AS revenue_this_week
  FROM media_catalog.title_revenue AS tr
  INNER JOIN media_catalog.media_content AS mc ON mc.id = tr.title_id
  CROSS JOIN latest
  WHERE tr.week_start = latest.w
  GROUP BY tr.title_id, mc.genre
),
threshold AS (
  SELECT quantile(0.75)(revenue_this_week) AS q75 FROM title_rev
)
SELECT
  a.title AS title_a,
  b.title AS title_b,
  a.genre AS genre,
  a.revenue_this_week AS revenue_a,
  b.revenue_this_week AS revenue_b
FROM title_rev AS a
INNER JOIN title_rev AS b
  ON a.genre = b.genre AND a.title_id < b.title_id
CROSS JOIN threshold
WHERE a.revenue_this_week >= threshold.q75
  AND b.revenue_this_week >= threshold.q75
  AND (
    positionCaseInsensitiveUTF8(a.title, b.title) > 0
    OR positionCaseInsensitiveUTF8(b.title, a.title) > 0
    OR leftUTF8(lowerUTF8(a.title), 18) = leftUTF8(lowerUTF8(b.title), 18)
  )
LIMIT 40
`.trim();

export const GREENLIGHT_QUERY_D_SLATE_HOLES = `
WITH latest AS (
  SELECT max(week_start) AS w FROM media_catalog.title_revenue
),
genre_stats AS (
  SELECT
    mc.genre AS genre,
    count(DISTINCT mc.id) AS title_count,
    coalesce(sum(tr.revenue_usd), 0) AS revenue_4w
  FROM media_catalog.media_content AS mc
  LEFT JOIN media_catalog.title_revenue AS tr
    ON mc.id = tr.title_id AND tr.week_start >= (SELECT w - 21 FROM latest)
  GROUP BY mc.genre
),
totals AS (
  SELECT sum(revenue_4w) AS total_rev, sum(title_count) AS total_titles FROM genre_stats
),
lang_stats AS (
  SELECT
    mc.language AS language,
    count(DISTINCT mc.id) AS title_count,
    coalesce(sum(tr.revenue_usd), 0) AS revenue_4w
  FROM media_catalog.media_content AS mc
  LEFT JOIN media_catalog.title_revenue AS tr
    ON mc.id = tr.title_id AND tr.week_start >= (SELECT w - 21 FROM latest)
  GROUP BY mc.language
)
SELECT
  'genre' AS hole_type,
  gs.genre AS dimension,
  gs.title_count,
  gs.revenue_4w,
  gs.revenue_4w / nullIf(t.total_rev, 0) AS revenue_share,
  gs.title_count / nullIf(t.total_titles, 0) AS title_share,
  (gs.revenue_4w / nullIf(t.total_rev, 0)) - (gs.title_count / nullIf(t.total_titles, 0)) AS gap_score
FROM genre_stats AS gs
CROSS JOIN totals AS t
UNION ALL
SELECT
  'language' AS hole_type,
  ls.language AS dimension,
  ls.title_count,
  ls.revenue_4w,
  ls.revenue_4w / nullIf((SELECT total_rev FROM totals), 0) AS revenue_share,
  ls.title_count / nullIf((SELECT total_titles FROM totals), 0) AS title_share,
  (ls.revenue_4w / nullIf((SELECT total_rev FROM totals), 0))
    - (ls.title_count / nullIf((SELECT total_titles FROM totals), 0)) AS gap_score
FROM lang_stats AS ls
ORDER BY gap_score DESC
`.trim();

export const GREENLIGHT_ANALYTICS_QUERIES = {
  genreInventory: { id: 'A_genre_inventory', sql: GREENLIGHT_QUERY_A_GENRE_INVENTORY },
  titleMomentum: { id: 'B_title_momentum', sql: GREENLIGHT_QUERY_B_TITLE_MOMENTUM },
  cannibalization: { id: 'C_cannibalization', sql: GREENLIGHT_QUERY_C_CANNIBALIZATION },
  slateHoles: { id: 'D_slate_holes', sql: GREENLIGHT_QUERY_D_SLATE_HOLES }
} as const;
