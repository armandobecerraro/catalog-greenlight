import {
  coerceGeneratedAskSql,
  detectAskedGenre,
  isGeminiPlannerUnavailable,
  isRevenueGenreBrief,
  isSlateHoleBrief,
  planSqlFallback,
  resolveAskIntent,
  synthesizeFromRows
} from '../../src/agents/askSqlFallback';

const COMEDY_BRIEF = 'Recommend a feel-good comedy under 2 hours';
const REVENUE_BRIEF = 'Which genre should we greenlight next based on recent revenue?';
const INVENTORY_SQL = `
SELECT mc.genre AS genre, count(DISTINCT mc.id) AS title_count
FROM media_catalog.media_content AS mc
GROUP BY mc.genre
`.trim();

describe('askSqlFallback', () => {
  it('detects Gemini quota and timeout errors', () => {
    expect(isGeminiPlannerUnavailable(new Error('Gemini API credits exhausted (429)'))).toBe(true);
    expect(isGeminiPlannerUnavailable(new Error('RESOURCE_EXHAUSTED'))).toBe(true);
    expect(isGeminiPlannerUnavailable(new Error('Gemini synthesis timed out after 10s'))).toBe(true);
    expect(isGeminiPlannerUnavailable(new Error('Query timed out after 30 seconds'))).toBe(false);
    expect(isGeminiPlannerUnavailable(new Error('Forbidden SQL keyword: DROP'))).toBe(false);
  });

  it('maps the under-represented genre chip to slate-holes SQL', () => {
    const plan = planSqlFallback('Which genre is under-represented in our catalog?');
    expect(plan.queryId).toBe('D_slate_holes');
    expect(plan.sql).toMatch(/gap_score/i);
    expect(plan.sql).toMatch(/^WITH|^SELECT/i);
    expect(isSlateHoleBrief('Which genre is under-represented in our catalog?')).toBe(true);
  });

  it('maps comedy / feel-good briefs to Comedy title SQL without inventing duration', () => {
    const plan = planSqlFallback(COMEDY_BRIEF);
    expect(plan.queryId).toBe('titles_comedy');
    expect(plan.sql).toMatch(/mc\.genre = 'Comedy'/);
    expect(plan.sql).toMatch(/\btitle\b/i);
    expect(plan.sql).not.toMatch(/duration|runtime/i);
    expect(detectAskedGenre(COMEDY_BRIEF)).toBe('Comedy');
  });

  it('maps remaining named genres to title-list SQL', () => {
    expect(planSqlFallback('Recommend a drama').queryId).toBe('titles_drama');
    expect(planSqlFallback('any documentary?').queryId).toBe('titles_documentary');
    expect(planSqlFallback('animation titles').sql).toMatch(/genre = 'Animation'/);
    expect(planSqlFallback('thriller pick').queryId).toBe('titles_thriller');
    expect(planSqlFallback('horror night').queryId).toBe('titles_horror');
    expect(planSqlFallback('romance for date night').queryId).toBe('titles_romance');
    expect(planSqlFallback('action feature').queryId).toBe('titles_action');
    expect(planSqlFallback('Recommend sci-fi').queryId).toBe('titles_sci_fi');
    expect(planSqlFallback('recomienda una comedia').queryId).toBe('titles_comedy');
  });

  it('maps revenue questions to last-week SELECT', () => {
    const plan = planSqlFallback('What titles had the highest revenue last week?');
    expect(plan.queryId).toBe('revenue_last_week');
    expect(plan.sql).toMatch(/ORDER BY tr\.revenue_usd DESC/i);
  });

  it('maps remaining question flavors to deterministic SQL', () => {
    expect(planSqlFallback('Sci-Fi late-night slot').queryId).toBe('sci_fi_slot');
    expect(planSqlFallback('week-over-week momentum').queryId).toBe('B_title_momentum');
    expect(planSqlFallback('how many titles per genre').queryId).toBe('A_genre_inventory');
    expect(planSqlFallback('cuántos titles inventory').queryId).toBe('A_genre_inventory');
    expect(planSqlFallback('qué género greenlight por ingresos recientes').queryId).toBe('D_slate_holes');
    expect(planSqlFallback('próximo género según revenue').queryId).toBe('D_slate_holes');
  });

  it('maps greenlight-next / recent-revenue briefs to gap_score SQL', () => {
    const plan = planSqlFallback(REVENUE_BRIEF);
    expect(isRevenueGenreBrief(REVENUE_BRIEF)).toBe(true);
    expect(isRevenueGenreBrief(COMEDY_BRIEF)).toBe(false);
    expect(plan.queryId).toBe('D_slate_holes');
    expect(plan.sql).toMatch(/gap_score/i);
    expect(plan.queryId).not.toBe(planSqlFallback(COMEDY_BRIEF).queryId);
  });

  it('remaps greenlight intent unless the user asked for the weekly slate', () => {
    expect(resolveAskIntent('greenlight', COMEDY_BRIEF)).toBe('catalog_qa');
    expect(resolveAskIntent('greenlight', REVENUE_BRIEF)).toBe('catalog_qa');
    expect(resolveAskIntent('greenlight', 'run greenlight weekly slate')).toBe('greenlight');
    expect(resolveAskIntent('greenlight', 'programming ritual three picks')).toBe('greenlight');
    expect(resolveAskIntent('greenlight', 'show 3 recommendations')).toBe('greenlight');
    expect(resolveAskIntent('stats', COMEDY_BRIEF)).toBe('stats');
    expect(resolveAskIntent('ingest', 'add title')).toBe('ingest');
    expect(resolveAskIntent('greenlight', 'three picks please')).toBe('greenlight');
  });

  it('coerces Gemini inventory SQL when the brief asked for comedy titles', () => {
    const coerced = coerceGeneratedAskSql(COMEDY_BRIEF, INVENTORY_SQL);
    expect(coerced?.queryId).toBe('titles_comedy');
    expect(coerced?.sql).toMatch(/genre = 'Comedy'/);
  });

  it('keeps Gemini SQL that already filters comedy titles', () => {
    const gemini = `SELECT mc.title, mc.genre FROM media_catalog.media_content mc WHERE mc.genre = 'Comedy' LIMIT 10`;
    expect(coerceGeneratedAskSql(COMEDY_BRIEF, gemini)).toBeNull();
  });

  it('coerces invented duration filters and inventory SQL on revenue-genre briefs', () => {
    const durationSql = `SELECT title FROM media_catalog.media_content WHERE genre = 'Comedy' AND duration < 120`;
    expect(coerceGeneratedAskSql(COMEDY_BRIEF, durationSql)?.queryId).toBe('titles_comedy');
    expect(
      coerceGeneratedAskSql(COMEDY_BRIEF, durationSql, 'media_catalog.media_content(id String, duration Int32)')
    ).toBeNull();

    expect(coerceGeneratedAskSql(REVENUE_BRIEF, INVENTORY_SQL)?.queryId).toBe('D_slate_holes');
    expect(coerceGeneratedAskSql(REVENUE_BRIEF, 'SELECT 1')?.queryId).toBe('D_slate_holes');
    expect(
      coerceGeneratedAskSql(COMEDY_BRIEF, "SELECT title FROM media_catalog.media_content WHERE genre = 'Drama'")
        ?.queryId
    ).toBe('titles_comedy');
    expect(
      coerceGeneratedAskSql(
        COMEDY_BRIEF,
        "SELECT genre, count() AS title_count FROM media_catalog.media_content WHERE genre = 'Comedy' GROUP BY genre"
      )?.queryId
    ).toBe('titles_comedy');
    expect(
      coerceGeneratedAskSql(REVENUE_BRIEF, 'SELECT genre, gap_score FROM holes ORDER BY gap_score DESC')
    ).toBeNull();
    expect(
      coerceGeneratedAskSql(
        REVENUE_BRIEF,
        'SELECT mc.genre AS genre, sum(tr.revenue_usd) AS revenue FROM media_catalog.media_content mc JOIN media_catalog.title_revenue tr ON tr.title_id = mc.id GROUP BY mc.genre'
      )
    ).toBeNull();
    expect(coerceGeneratedAskSql('how many titles per genre', INVENTORY_SQL)).toBeNull();
  });

  it('synthesizes wow, revenue, inventory, empty, and generic rows', () => {
    expect(synthesizeFromRows('q', []).answer).toMatch(/0 rows/);
    expect(
      synthesizeFromRows('wow', [{ title: 'A', genre: 'Drama', wow_pct: 0.5 }]).recommendations[0].title
    ).toBe('A');
    expect(
      synthesizeFromRows('rev', [{ title: 'B', genre: 'Comedy', revenue_usd: 90 }]).answer
    ).toMatch(/B/);
    expect(
      synthesizeFromRows('inv', [
        { genre: 'Thriller', title_count: 2 },
        { genre: 'Comedy', title_count: 40 }
      ]).answer
    ).toMatch(/Thriller/);
    expect(synthesizeFromRows('other', [{ title: 'C', extra: 1 }]).recommendations[0].title).toBe('C');
  });

  it('synthesizes comedy titles and does not fall back to fewest-titles copy', () => {
    const { answer, recommendations } = synthesizeFromRows(COMEDY_BRIEF, [
      { title: 'Sunday Laughs', genre: 'Comedy', revenue_usd: 400, description: 'warm' },
      { title: 'Harbor Jokes', genre: 'Comedy', revenue_usd: 220 }
    ]);
    expect(answer).toMatch(/Sunday Laughs/);
    expect(answer).toMatch(/Comedy/);
    expect(answer).toMatch(/not a column/i);
    expect(answer).not.toMatch(/fewest titles/);
    expect(recommendations[0].title).toBe('Sunday Laughs');
  });

  it('synthesizes a revenue-grounded genre pick distinct from comedy titles', () => {
    const comedy = synthesizeFromRows(COMEDY_BRIEF, [
      { title: 'Sunday Laughs', genre: 'Comedy', revenue_usd: 400 }
    ]);
    const revenue = synthesizeFromRows(REVENUE_BRIEF, [
      {
        hole_type: 'genre',
        dimension: 'Thriller',
        gap_score: 0.07,
        title_share: 0.075,
        revenue_share: 0.144
      },
      {
        hole_type: 'genre',
        dimension: 'Comedy',
        gap_score: -0.08,
        title_share: 0.26,
        revenue_share: 0.18
      }
    ]);
    expect(revenue.answer).toMatch(/Thriller/);
    expect(revenue.answer).toMatch(/gap_score/);
    expect(revenue.answer).toMatch(/recent revenue/);
    expect(revenue.answer).not.toMatch(/fewest titles/);
    expect(revenue.answer).not.toBe(comedy.answer);
    expect(revenue.recommendations[0].title).toBe('Thriller');
  });

  it('synthesizes an underserved-genre answer from gap_score rows', () => {
    const { answer, recommendations } = synthesizeFromRows('Which genre is under-represented?', [
      { hole_type: 'genre', dimension: 'Documentary', gap_score: 0.074, title_share: 0.07, revenue_share: 0.14 },
      { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.069, title_share: 0.08, revenue_share: 0.15 },
      { hole_type: 'language', dimension: 'es', gap_score: 0.013, title_share: 0.2, revenue_share: 0.21 }
    ]);
    expect(answer).toMatch(/Documentary/);
    expect(answer).toMatch(/underserved/);
    expect(answer).toMatch(/0\.074/);
    expect(recommendations.map(r => r.title)).toEqual(['Documentary', 'Thriller']);
    expect(recommendations.find(r => r.title === 'es')).toBeUndefined();
  });

  it('parses string metrics and remaining row shapes', () => {
    expect(isGeminiPlannerUnavailable('quota exceeded')).toBe(true);
    expect(isGeminiPlannerUnavailable(12)).toBe(false);

    const wow = synthesizeFromRows('wow', [
      { title: 'A', genre: 'Drama', wow_pct: '0.4' },
      { title: 'B', genre: 'Comedy', wow_pct: '0.1' }
    ]);
    expect(wow.recommendations[0].title).toBe('A');

    const weekRev = synthesizeFromRows('rev', [
      { title: 'Low', revenue_this_week: 10 },
      { title: 'C', revenue_this_week: '90' }
    ]);
    expect(weekRev.recommendations[0].title).toBe('C');
    expect(weekRev.answer).toMatch(/C/);
    const fourWeek = synthesizeFromRows('rev', [{ title: 'D', revenue_4w: 12 }]);
    expect(fourWeek.answer).toMatch(/D/);

    const inventoryCnt = synthesizeFromRows('inv', [{ genre: 'Horror', cnt: '1' }]);
    expect(inventoryCnt.answer).toMatch(/Horror/);

    const gapByGenre = synthesizeFromRows('gap', [{ genre: 'Thriller', gap_score: '0.2' }]);
    expect(gapByGenre.recommendations[0].title).toBe('Thriller');

    const gapByHoleOnly = synthesizeFromRows('gap', [
      { hole_type: 'language', dimension: 'es', gap_score: 0.01 },
      { hole_type: 'language', dimension: 'pt', gap_score: 0.004 }
    ]);
    expect(gapByHoleOnly.recommendations).toEqual([]);
    expect(gapByHoleOnly.answer).toMatch(/language code/i);
    expect(gapByHoleOnly.answer).toMatch(/“es”/);

    const unnamedLanguage = synthesizeFromRows('gap', [{ hole_type: 'language', gap_score: 0.02 }]);
    expect(unnamedLanguage.answer).toMatch(/unknown/);

    const noGenreSlice = synthesizeFromRows('gap', [{ hole_type: 'other', gap_score: 0.3 }]);
    expect(noGenreSlice.answer).toMatch(/no genre slice/);
    expect(noGenreSlice.recommendations).toEqual([]);

    const emptyDim = synthesizeFromRows('gap', [{ hole_type: 'genre', gap_score: 0 }]);
    expect(emptyDim.answer).toMatch(/This genre is the most underserved/);

    const emptyRevenueDim = synthesizeFromRows(REVENUE_BRIEF, [{ hole_type: 'genre', gap_score: 0.05 }]);
    expect(emptyRevenueDim.answer).toMatch(/This genre is the strongest next-genre pick/);
    expect(emptyRevenueDim.answer).toMatch(/recent revenue/);

    const generic = synthesizeFromRows('other', [{ title: '', extra: 1 }, { title: 'E' }]);
    expect(generic.recommendations[0].title).toBe('E');
  });

  it('uses prompt-aware inventory synthesis instead of always fewest titles', () => {
    const inventory = [
      { genre: 'Animation', title_count: 10, revenue_4w: 100 },
      { genre: 'Comedy', title_count: 52, revenue_4w: 20000 }
    ];
    const revenueFromInventory = synthesizeFromRows(REVENUE_BRIEF, inventory);
    expect(revenueFromInventory.answer).toMatch(/Comedy/);
    expect(revenueFromInventory.answer).not.toMatch(/fewest titles/);

    const namelessSlice = synthesizeFromRows(REVENUE_BRIEF, [
      { genre: '', title_count: 2, revenue_4w: 50 }
    ]);
    expect(namelessSlice.recommendations[0].title).toBe('genre');

    const comedyFromInventory = synthesizeFromRows(COMEDY_BRIEF, inventory);
    expect(comedyFromInventory.answer).toMatch(/Comedy/);
    expect(comedyFromInventory.answer).toMatch(/52/);
    expect(comedyFromInventory.answer).not.toMatch(/Animation has the fewest/);

    const noMatchTitles = synthesizeFromRows(COMEDY_BRIEF, [
      { title: 'Road 114', genre: 'Documentary', revenue_usd: 9 }
    ]);
    expect(noMatchTitles.answer).toMatch(/no Comedy titles/i);
    expect(noMatchTitles.recommendations).toEqual([]);

    const untitledComedy = synthesizeFromRows(COMEDY_BRIEF, [
      { title: 'Warm Night', revenue_usd: 3 }
    ]);
    expect(untitledComedy.recommendations[0].title).toBe('Warm Night');

    const missingSlice = synthesizeFromRows(COMEDY_BRIEF, [{ genre: 'Drama', title_count: 3 }]);
    expect(missingSlice.answer).toMatch(/no Comedy slice/);
  });
});
