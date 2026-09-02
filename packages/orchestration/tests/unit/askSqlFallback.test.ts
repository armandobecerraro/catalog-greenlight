import { isGeminiPlannerUnavailable, planSqlFallback, synthesizeFromRows } from '../../src/agents/askSqlFallback';

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

  it('synthesizes an underserved-genre answer from gap_score rows', () => {
    const { answer, recommendations } = synthesizeFromRows('Which genre is under-represented?', [
      { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.07, title_share: 0.07, revenue_share: 0.14 },
      { hole_type: 'genre', dimension: 'Comedy', gap_score: -0.08, title_share: 0.26, revenue_share: 0.18 }
    ]);
    expect(answer).toMatch(/Thriller/);
    expect(recommendations[0].title).toBe('Thriller');
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

    const gapByHoleOnly = synthesizeFromRows('gap', [{ hole_type: 'language', dimension: 'es' }]);
    expect(gapByHoleOnly.recommendations[0].title).toBe('es');

    const emptyDim = synthesizeFromRows('gap', [{ hole_type: 'genre', gap_score: 0 }]);
    expect(emptyDim.answer).toMatch(/This genre/);

    const generic = synthesizeFromRows('other', [{ title: '', extra: 1 }, { title: 'E' }]);
    expect(generic.recommendations[0].title).toBe('E');
  });
});
