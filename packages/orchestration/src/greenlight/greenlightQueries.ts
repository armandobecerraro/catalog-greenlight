/** Deterministic SELECT queries for weekly greenlight analysis (no Gemini SQL). */

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
WITH latest AS (
  SELECT max(week_start) AS w FROM media_catalog.title_revenue
),
this_week AS (
  SELECT
    tr.title_id,
    any(tr.title) AS title,
    sum(tr.revenue_usd) AS revenue_this_week,
    sum(tr.views) AS views_this_week
  FROM media_catalog.title_revenue AS tr
  CROSS JOIN latest
  WHERE tr.week_start = latest.w
  GROUP BY tr.title_id
),
prior_week AS (
  SELECT
    tr.title_id,
    sum(tr.revenue_usd) AS revenue_prior_week
  FROM media_catalog.title_revenue AS tr
  CROSS JOIN latest
  WHERE tr.week_start = latest.w - 7
  GROUP BY tr.title_id
)
SELECT
  mc.id AS title_id,
  mc.title AS title,
  mc.genre AS genre,
  mc.language AS language,
  tw.revenue_this_week,
  coalesce(pw.revenue_prior_week, 0) AS revenue_prior_week,
  if(
    coalesce(pw.revenue_prior_week, 0) = 0,
    if(tw.revenue_this_week > 0, 1.0, 0.0),
    (tw.revenue_this_week - pw.revenue_prior_week) / pw.revenue_prior_week
  ) AS wow_pct,
  tw.views_this_week
FROM this_week AS tw
INNER JOIN media_catalog.media_content AS mc ON mc.id = tw.title_id
LEFT JOIN prior_week AS pw ON pw.title_id = tw.title_id
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
