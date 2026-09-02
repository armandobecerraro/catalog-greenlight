import {
  runGreenlightAnalysis,
  GREENLIGHT_SYNTHESIZE_TIMEOUT_MS
} from '../../src/greenlight/GreenlightAnalyst';
import { IMcpConnector, IGeminiReasoningPort } from '@bas/core';

describe('GreenlightAnalyst', () => {
  const momentumRows = Array.from({ length: 25 }, (_, i) => ({
    title_id: `t${i}`,
    title: i === 24 ? 'Late Winner' : `Title ${i}`,
    genre: i === 24 ? 'Thriller' : 'Comedy',
    language: 'en',
    revenue_this_week: i === 24 ? 600 : 80,
    revenue_prior_week: i === 24 ? 200 : 85,
    wow_pct: i === 24 ? 2.0 : -0.02,
    views_this_week: 1000
  }));

  const mockMcp: jest.Mocked<IMcpConnector> = {
    name: 'clickhouse-mcp',
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn(),
    stream: jest.fn(),
    listDatabases: jest.fn(),
    listTables: jest.fn(),
    runQuery: jest.fn()
  };

  const mockReasoning: jest.Mocked<IGeminiReasoningPort> = {
    classifyIntent: jest.fn(),
    generateSql: jest.fn(),
    synthesize: jest.fn(),
    synthesizeGreenlight: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO media_catalog.agent_runs')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [
            { genre: 'Comedy', title_count: 40, revenue_4w: 8000 },
            { genre: 'Thriller', title_count: 8, revenue_4w: 30000 }
          ],
          metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('wow_pct')) {
        return { rows: momentumRows, metadata: { rowCount: 25, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('quantile')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('hole_type')) {
        return {
          rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.5 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
  });

  it('still returns 3 recommendations when Gemini throws', async () => {
    mockReasoning.synthesizeGreenlight.mockRejectedValue(new Error('Gemini unavailable'));

    const result = await runGreenlightAnalysis(mockMcp, mockReasoning, 'gemini-test');

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations![0].opportunity_score).toBeDefined();
    const synth = result.steps.find(s => s.step === 'SYNTHESIZE');
    expect(synth?.status).toBe('completed');
    expect((synth?.output as { fallback?: boolean }).fallback).toBe(true);
    expect(result.recommendations!.some(r => r.title === 'Late Winner')).toBe(true);
  });

  it('still returns 3 recommendations when Gemini hangs past synthesis timeout', async () => {
    jest.useFakeTimers();
    mockReasoning.synthesizeGreenlight.mockImplementation(() => new Promise(() => {}));

    const runPromise = runGreenlightAnalysis(mockMcp, mockReasoning, 'gemini-test');
    await jest.advanceTimersByTimeAsync(GREENLIGHT_SYNTHESIZE_TIMEOUT_MS + 1);
    const result = await runPromise;

    expect(result.recommendations).toHaveLength(3);
    const synth = result.steps.find(s => s.step === 'SYNTHESIZE');
    expect(synth?.status).toBe('completed');
    expect((synth?.output as { fallback?: boolean; geminiError?: string }).fallback).toBe(true);
    expect((synth?.output as { geminiError?: string }).geminiError).toMatch(/timed out/i);
    jest.useRealTimers();
  });

  it('still returns 3 recommendations when AUDIT INSERT fails', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'Weekly picks',
      recommendations: []
    });
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO media_catalog.agent_runs')) {
        throw new Error('audit write failed');
      }
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [
            { genre: 'Comedy', title_count: 40, revenue_4w: 8000 },
            { genre: 'Thriller', title_count: 8, revenue_4w: 30000 }
          ],
          metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('wow_pct')) {
        return { rows: momentumRows, metadata: { rowCount: 25, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('quantile')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('hole_type')) {
        return {
          rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.5 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });

    const result = await runGreenlightAnalysis(mockMcp, mockReasoning, 'gemini-test');

    expect(result.recommendations).toHaveLength(3);
    const audit = result.steps.find(s => s.step === 'AUDIT');
    expect(audit?.status).toBe('error');
    expect(audit?.error).toMatch(/audit write failed/i);
  });

  it('runs four analytics queries in parallel during DISCOVER', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'ok',
      recommendations: []
    });

    await runGreenlightAnalysis(mockMcp, mockReasoning, 'gemini-test');

    const analyticsCalls = mockMcp.runQuery.mock.calls.filter(
      c => !String(c[0]).includes('INSERT INTO media_catalog.agent_runs')
    );
    expect(analyticsCalls).toHaveLength(4);
  });

  it('filters poison timeout rows from momentum results before scoring', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'ok',
      recommendations: []
    });
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO media_catalog.agent_runs')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [
            { genre: 'Comedy', title_count: 40, revenue_4w: 8000 },
            { genre: 'Thriller', title_count: 8, revenue_4w: 30000 }
          ],
          metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('wow_pct')) {
        return {
          rows: [
            { text: 'Query timed out after 30 seconds' },
            ...momentumRows
          ],
          metadata: { rowCount: 26, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('quantile')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('hole_type')) {
        return {
          rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.5 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });

    const result = await runGreenlightAnalysis(mockMcp, mockReasoning, 'gemini-test');
    const discover = result.steps.find(s => s.step === 'DISCOVER');
    const momentumQuery = (discover?.output as { queries: Array<{ id: string; rowCount: number }> }).queries.find(
      q => q.id === 'B_title_momentum'
    );

    expect(momentumQuery?.rowCount).toBe(25);
    expect(result.recommendations!.some(r => r.title === 'Late Winner')).toBe(true);
  });

  it('escapes single quotes in AUDIT INSERT model name', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'Weekly picks',
      recommendations: []
    });
    let auditSql = '';
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO media_catalog.agent_runs')) {
        auditSql = sql;
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [
            { genre: 'Comedy', title_count: 40, revenue_4w: 8000 },
            { genre: 'Thriller', title_count: 8, revenue_4w: 30000 }
          ],
          metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('wow_pct')) {
        return { rows: momentumRows, metadata: { rowCount: 25, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('quantile')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('hole_type')) {
        return {
          rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.5 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });

    await runGreenlightAnalysis(mockMcp, mockReasoning, "gemini'--");

    expect(auditSql).toContain("'gemini''--'");
    expect(auditSql).not.toMatch(/model,\s*'gemini',\s*'/);
  });

  it('uses full momentum rows for scoring (not DISCOVER timeline slice)', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'ok',
      recommendations: []
    });

    const result = await runGreenlightAnalysis(mockMcp, mockReasoning, 'gemini-test');
    const plan = result.steps.find(s => s.step === 'PLAN_SQL');
    expect((plan?.output as { momentumRowsScored?: number }).momentumRowsScored).toBe(25);
    expect(result.recommendations!.some(r => r.title === 'Late Winner')).toBe(true);
  });
});
