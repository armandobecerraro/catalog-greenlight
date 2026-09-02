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

  it('synthesizes an underserved-genre answer from gap_score rows', () => {
    const { answer, recommendations } = synthesizeFromRows('Which genre is under-represented?', [
      { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.07, title_share: 0.07, revenue_share: 0.14 },
      { hole_type: 'genre', dimension: 'Comedy', gap_score: -0.08, title_share: 0.26, revenue_share: 0.18 }
    ]);
    expect(answer).toMatch(/Thriller/);
    expect(recommendations[0].title).toBe('Thriller');
  });
});
