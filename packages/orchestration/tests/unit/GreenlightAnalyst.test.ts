import {
  runGreenlightAnalysis,
  GREENLIGHT_SYNTHESIZE_TIMEOUT_MS
} from '../../src/greenlight/GreenlightAnalyst';
import { IMcpConnector, IGeminiReasoningPort, IAgentAuditPort } from '@bas/core';

describe('GreenlightAnalyst', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
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

  const mockAudit: jest.Mocked<IAgentAuditPort> = {
    record: jest.fn().mockResolvedValue(undefined)
  };

  const analyze = (model = 'gemini-test') =>
    runGreenlightAnalysis(mockMcp, mockReasoning, model, mockAudit);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAudit.record.mockResolvedValue(undefined);
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

    const result = await analyze();

    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations![0].opportunity_score).toBeDefined();
    const synth = result.steps.find(s => s.step === 'SYNTHESIZE');
    expect(synth?.status).toBe('completed');
    expect((synth?.output as { fallback?: boolean }).fallback).toBe(true);
    expect(result.fallback).toBe(true);
    expect(result.geminiStatus).toBe('error');
    expect(result.mcpMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.geminiMs).toBe('number');
    expect(result.recommendations!.some(r => r.title === 'Late Winner')).toBe(true);
    const rows = result.queryRows ?? [];
    expect(rows[0]).toEqual(expect.objectContaining({ language_gap: expect.any(Number) }));
  });

  it('still returns 3 recommendations when Gemini hangs past synthesis timeout', async () => {
    jest.useFakeTimers();
    mockReasoning.synthesizeGreenlight.mockImplementation(() => new Promise(() => {}));

    const runPromise = analyze();
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
    mockAudit.record.mockRejectedValueOnce(new Error('audit write failed'));

    const result = await analyze();

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

    await analyze();

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

    const result = await analyze();
    const discover = result.steps.find(s => s.step === 'DISCOVER');
    const momentumQuery = (discover?.output as { queries: Array<{ id: string; rowCount: number }> }).queries.find(
      q => q.id === 'B_title_momentum'
    );

    expect(momentumQuery?.rowCount).toBe(25);
    expect(result.recommendations!.some(r => r.title === 'Late Winner')).toBe(true);
  });

  it('passes model name with quotes to the audit port', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'Weekly picks',
      recommendations: []
    });

    await analyze("gemini'--");

    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini'--" })
    );
  });

  it('uses full momentum rows for scoring (not DISCOVER timeline slice)', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'ok',
      recommendations: []
    });

    const result = await analyze();
    const plan = result.steps.find(s => s.step === 'PLAN_SQL');
    expect((plan?.output as { momentumRowsScored?: number }).momentumRowsScored).toBe(25);
    expect(result.recommendations!.some(r => r.title === 'Late Winner')).toBe(true);
  });

  it('keeps Gemini narrative when recommendations ground to scored titles', async () => {
    mockReasoning.synthesizeGreenlight.mockImplementation(async (_p, _sql, rows) => ({
      answer: 'Grounded memo',
      recommendations: rows.slice(0, 3).map(r => ({
        title: String(r.title),
        genre: String(r.genre ?? 'Thriller'),
        justification: 'measured',
        evidence: 'score'
      }))
    }));

    const result = await analyze();
    const synth = result.steps.find(s => s.step === 'SYNTHESIZE');
    expect(result.answer).toBe('Grounded memo');
    expect((synth?.output as { fallback?: boolean }).fallback).toBe(false);
    expect(result.fallback).toBe(false);
    expect(result.geminiStatus).toBe('explained');
  });

  it('records analytics query errors after retry is exhausted', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({ answer: 'ok', recommendations: [] });
    mockMcp.runQuery.mockRejectedValue(new Error('mcp down'));
    const result = await analyze();
    const discover = result.steps.find(s => s.step === 'DISCOVER');
    const queries = (discover?.output as { queries: Array<{ error?: string }> }).queries;
    expect(queries.every(q => q.error === 'mcp down')).toBe(true);
    expect(mockMcp.runQuery.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('uses fallback copy when Gemini returns an empty answer', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: '',
      recommendations: [{ title: 'Hallucinated', genre: 'Sci-Fi', justification: 'nope', evidence: 'nope' }]
    });
    const result = await analyze();
    expect(result.answer).toMatch(/Weekly greenlight from measured ClickHouse/);
    expect((result.steps.find(s => s.step === 'SYNTHESIZE')?.output as { fallback?: boolean }).fallback).toBe(true);
  });

  it('stringifies non-Error synthesize, analytics, and audit failures', async () => {
    mockReasoning.synthesizeGreenlight.mockRejectedValue('writer-down');
    mockAudit.record.mockRejectedValue('audit-down');
    mockMcp.runQuery.mockRejectedValue('mcp-down');
    const result = await analyze();
    expect((result.steps.find(s => s.step === 'SYNTHESIZE')?.output as { geminiError?: string }).geminiError).toBe(
      'writer-down'
    );
    expect(result.steps.find(s => s.step === 'AUDIT')?.error).toBe('audit-down');
    const queries = (result.steps.find(s => s.step === 'DISCOVER')?.output as { queries: Array<{ error?: string }> })
      .queries;
    expect(queries.every(q => q.error === 'mcp-down')).toBe(true);
  });

  it('keeps momentum rows that have a title even if the text looks like a timeout', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({ answer: 'ok', recommendations: [] });
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('wow_pct')) {
        return {
          rows: [
            {
              title_id: 'keep',
              title: 'Keep Me',
              genre: 'Thriller',
              language: 'es',
              revenue_this_week: 500,
              revenue_prior_week: 100,
              wow_pct: 4,
              views_this_week: 9,
              text: 'Query timed out after 30 seconds'
            }
          ],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [{ genre: 'Thriller', title_count: 1, revenue_4w: 500 }],
          metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const result = await analyze();
    expect(result.recommendations!.some(r => r.title === 'Keep Me')).toBe(true);
  });

  it('still scores when inventory rows omit genre or title_count', async () => {
    mockReasoning.synthesizeGreenlight.mockResolvedValue({ answer: 'ok', recommendations: [] });
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [
            { title_count: 0 },
            { genre: '', title_count: 5 },
            { genre: 'Drama' },
            { genre: 'Thriller', title_count: 8, revenue_4w: 1 }
          ],
          metadata: { rowCount: 4, latencyMs: 1, partner: 'clickhouse' }
        };
      }
      if (sql.includes('wow_pct')) {
        return { rows: momentumRows, metadata: { rowCount: 25, latencyMs: 1, partner: 'clickhouse' } };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const result = await analyze();
    expect(result.recommendations).toHaveLength(3);
    expect(result.geminiStatus).toBe('explained');
    expect(result.runnerUp || result.recommendations![0]).toBeTruthy();
  });
});
