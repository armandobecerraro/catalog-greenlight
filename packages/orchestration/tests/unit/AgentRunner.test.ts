import { AgentRunner } from '../../src/agents/AgentRunner';
import { clearSchemaCache } from '../../src/agents/SchemaCache';
import { IMcpConnector, IGeminiReasoningPort, AgentIntent } from '@bas/core';

describe('AgentRunner', () => {
  const schemaRows = [
    { name: 'id', type: 'UUID' },
    { name: 'title', type: 'String' },
    { name: 'genre', type: 'String' }
  ];

  const mockMcp: jest.Mocked<IMcpConnector> = {
    name: 'clickhouse-mcp',
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn(),
    stream: jest.fn(),
    listDatabases: jest.fn().mockResolvedValue(['media_catalog']),
    listTables: jest.fn().mockResolvedValue(['media_content', 'title_revenue', 'agent_runs']),
    runQuery: jest.fn()
  };

  const mockReasoning: jest.Mocked<IGeminiReasoningPort> = {
    classifyIntent: jest.fn().mockResolvedValue('catalog_qa' as AgentIntent),
    generateSql: jest.fn().mockResolvedValue('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre'),
    synthesize: jest.fn().mockResolvedValue({
      answer: 'Sci-Fi is under-represented with 8 titles.',
      recommendations: []
    }),
    synthesizeGreenlight: jest.fn().mockResolvedValue({
      answer: 'Greenlight summary.',
      recommendations: [
        { title: 'Crimen sin Fronteras: Bogotá', genre: 'Thriller', justification: 'Breakout', evidence: 'wow 1.33' }
      ]
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearSchemaCache();
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        const table = sql.includes('title_revenue') ? 'title_revenue' : 'media_content';
        return {
          rows: table === 'media_content' ? schemaRows : [{ name: 'title_id', type: 'UUID' }],
          metadata: { rowCount: 2, latencyMs: 5, partner: 'clickhouse' }
        };
      }
      if (sql.includes('INSERT INTO media_catalog.agent_runs')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 3, partner: 'clickhouse' } };
      }
      return {
        rows: [{ genre: 'Sci-Fi', cnt: 8 }, { genre: 'Drama', cnt: 12 }],
        metadata: { rowCount: 2, latencyMs: 12, partner: 'clickhouse' }
      };
    });
  });

  it('executes all 6 agent steps in order', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test');
    const result = await runner.run('Which genre is under-represented?');

    expect(result.steps.map(s => s.step)).toEqual([
      'INTENT',
      'DISCOVER',
      'PLAN_SQL',
      'EXECUTE',
      'SYNTHESIZE',
      'AUDIT'
    ]);
    expect(result.steps.every(s => s.status === 'completed')).toBe(true);
    expect(mockReasoning.classifyIntent).toHaveBeenCalled();
    expect(mockMcp.listDatabases).toHaveBeenCalled();
    expect(mockReasoning.generateSql).toHaveBeenCalled();
    expect(result.answer).toContain('Sci-Fi');
    expect(result.sql).toContain('SELECT');
  });

  it('skips INTENT Gemini when defaultIntent is stats', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test');
    const result = await runner.run('weekly stats', { defaultIntent: 'stats' });

    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
    expect(result.intent).toBe('stats');
  });

  it('caches live schema for 5 minutes', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test');
    await runner.run('genre count');
    await runner.run('genre count again');

    const columnQueries = mockMcp.runQuery.mock.calls.filter(c =>
      String(c[0]).includes('system.columns')
    );
    expect(columnQueries.length).toBeGreaterThan(0);
    const firstRunCount = columnQueries.length;
    await runner.run('third question');
    const afterCache = mockMcp.runQuery.mock.calls.filter(c =>
      String(c[0]).includes('system.columns')
    );
    expect(afterCache.length).toBe(firstRunCount);
  });

  it('retries PLAN_SQL once when EXECUTE returns 0 rows', async () => {
    let selectCalls = 0;
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      selectCalls++;
      if (selectCalls === 1) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      return {
        rows: [{ genre: 'Thriller', cnt: 3 }],
        metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
      };
    });
    mockReasoning.generateSql
      .mockResolvedValueOnce('SELECT 1 WHERE 0')
      .mockResolvedValueOnce('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre');

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test');
    const result = await runner.run('Which genre is under-represented?');

    expect(mockReasoning.generateSql).toHaveBeenCalledTimes(2);
    const executeStep = result.steps.find(s => s.step === 'EXECUTE');
    expect(executeStep?.output).toMatchObject({ attempts: expect.any(Array) });
    expect((executeStep?.output as { attempts: unknown[] }).attempts.length).toBeGreaterThanOrEqual(2);
  });

  it('runGreenlight skips classifyIntent and uses deterministic pipeline', async () => {
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('INSERT INTO media_catalog.agent_runs')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('GROUP BY mc.genre') && sql.includes('revenue_4w')) {
        return {
          rows: [{ genre: 'Thriller', title_count: 14, revenue_4w: 28000 }],
          metadata: { rowCount: 1, latencyMs: 5, partner: 'clickhouse' }
        };
      }
      if (sql.includes('wow_pct')) {
        return {
          rows: [
            {
              title_id: '1',
              title: 'Crimen sin Fronteras: Bogotá',
              genre: 'Thriller',
              language: 'es',
              revenue_this_week: 420,
              revenue_prior_week: 180,
              wow_pct: 1.33,
              views_this_week: 80000
            }
          ],
          metadata: { rowCount: 1, latencyMs: 5, partner: 'clickhouse' }
        };
      }
      if (sql.includes('quantile')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 5, partner: 'clickhouse' } };
      }
      if (sql.includes('hole_type')) {
        return {
          rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.4 }],
          metadata: { rowCount: 1, latencyMs: 5, partner: 'clickhouse' }
        };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test');
    const result = await runner.runGreenlight();

    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
    expect(mockReasoning.generateSql).not.toHaveBeenCalled();
    expect(mockReasoning.synthesizeGreenlight).toHaveBeenCalled();
    expect(result.intent).toBe('greenlight');
    expect(result.steps).toHaveLength(6);
  });
});
