import { AgentRunner } from '../../src/agents/AgentRunner';
import { clearSchemaCache } from '../../src/agents/SchemaCache';
import { IMcpConnector, IGeminiReasoningPort, IAgentAuditPort, AgentIntent } from '@bas/core';

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

  const mockAudit: jest.Mocked<IAgentAuditPort> = {
    record: jest.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearSchemaCache();
    mockReasoning.classifyIntent.mockResolvedValue('catalog_qa' as AgentIntent);
    mockReasoning.generateSql.mockResolvedValue(
      'SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre'
    );
    mockReasoning.synthesize.mockResolvedValue({
      answer: 'Sci-Fi is under-represented with 8 titles.',
      recommendations: []
    });
    mockReasoning.synthesizeGreenlight.mockResolvedValue({
      answer: 'Greenlight summary.',
      recommendations: [
        { title: 'Crimen sin Fronteras: Bogotá', genre: 'Thriller', justification: 'Breakout', evidence: 'wow 1.33' }
      ]
    });
    mockAudit.record.mockResolvedValue(undefined);
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
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
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
    expect(mockAudit.record).toHaveBeenCalled();
  });

  it('skips INTENT Gemini when defaultIntent is stats', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('weekly stats', { defaultIntent: 'stats' });

    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
    expect(result.intent).toBe('stats');
  });

  it('caches live schema for 5 minutes', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
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

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
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

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.runGreenlight();

    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
    expect(mockReasoning.generateSql).not.toHaveBeenCalled();
    expect(mockReasoning.synthesizeGreenlight).toHaveBeenCalled();
    expect(result.intent).toBe('greenlight');
    expect(result.steps).toHaveLength(6);
  });

  it('falls back to deterministic MCP SQL when Gemini planner returns 429', async () => {
    mockReasoning.classifyIntent.mockRejectedValue(new Error('Gemini API credits exhausted (429)'));
    mockReasoning.generateSql.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));
    mockReasoning.synthesize.mockRejectedValue(new Error('quota exceeded'));
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      return {
        rows: [
          {
            hole_type: 'genre',
            dimension: 'Thriller',
            gap_score: 0.07,
            title_share: 0.075,
            revenue_share: 0.144
          }
        ],
        metadata: { rowCount: 1, latencyMs: 8, partner: 'clickhouse' }
      };
    });

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented in our catalog?');

    expect(result.fallback).toBe(true);
    expect(result.sql).toMatch(/gap_score/i);
    expect(result.answer).toMatch(/Thriller/);
    expect(result.queryRows).toHaveLength(1);
    expect(result.steps.find(s => s.step === 'DISCOVER')?.status).toBe('completed');
    expect(result.steps.find(s => s.step === 'EXECUTE')?.status).toBe('completed');
    expect(result.steps.find(s => s.step === 'PLAN_SQL')?.output).toMatchObject({ fallback: true });
  });

  it('skips AUDIT when requested', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented?', { skipAudit: true });
    expect(result.steps.map(s => s.step)).not.toContain('AUDIT');
    expect(mockAudit.record).not.toHaveBeenCalled();
  });

  it('routes defaultIntent greenlight to the analyst pipeline', async () => {
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
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
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('weekly picks', { defaultIntent: 'greenlight' });
    expect(result.intent).toBe('greenlight');
    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
    expect(mockReasoning.synthesizeGreenlight).toHaveBeenCalled();
  });

  it('does not retry EXECUTE when ingest returns 0 rows', async () => {
    mockReasoning.classifyIntent.mockResolvedValue('ingest' as AgentIntent);
    mockReasoning.generateSql.mockResolvedValue(
      "INSERT INTO media_catalog.media_content (id) VALUES ('x')"
    );
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
    });
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('ingest this title');
    expect(result.intent).toBe('ingest');
    expect(mockReasoning.generateSql).toHaveBeenCalledTimes(1);
    expect(result.queryRows).toEqual([]);
  });

  it('rethrows planner errors that are not Gemini outages', async () => {
    mockReasoning.generateSql.mockRejectedValue(new Error('Forbidden SQL keyword: DROP'));
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    await expect(runner.run('drop everything')).rejects.toThrow(/Forbidden SQL/);
  });

  it('falls back during SYNTHESIZE when Gemini writer is unavailable', async () => {
    mockReasoning.synthesize.mockRejectedValue(new Error('quota exceeded'));
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented in our catalog?');
    expect(result.fallback).toBe(true);
    expect(result.answer).toBeTruthy();
  });

  it('does not retry SQL when ingest EXECUTE throws', async () => {
    mockReasoning.classifyIntent.mockResolvedValue('ingest' as AgentIntent);
    mockReasoning.generateSql.mockResolvedValue(
      "INSERT INTO media_catalog.media_content (id) VALUES ('x')"
    );
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      throw new Error('insert failed');
    });
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('ingest this title');
    expect(result.intent).toBe('ingest');
    expect(mockReasoning.generateSql).toHaveBeenCalledTimes(1);
    expect(result.queryRows).toEqual([]);
  });

  it('falls back when EXECUTE retry planning is unavailable', async () => {
    let selects = 0;
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      selects += 1;
      if (selects === 1) throw new Error('clickhouse busy');
      return {
        rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.2 }],
        metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
      };
    });
    mockReasoning.generateSql
      .mockResolvedValueOnce('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre')
      .mockRejectedValueOnce(new Error('RESOURCE_EXHAUSTED'));

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented in our catalog?');
    expect(result.fallback).toBe(true);
    expect(result.sql).toMatch(/gap_score/i);
  });

  it('rethrows non-Gemini retry planner errors after execute failure', async () => {
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      throw new Error('syntax error near JOIN');
    });
    mockReasoning.generateSql
      .mockResolvedValueOnce('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre')
      .mockRejectedValueOnce(new Error('Forbidden SQL keyword: DROP'));

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    await expect(runner.run('Which genre is under-represented?')).rejects.toThrow(/Forbidden SQL/);
  });

  it('falls back when execute fails with a Gemini outage even if retry SQL is invalid', async () => {
    let selects = 0;
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      selects += 1;
      if (selects === 1) throw new Error('UNAVAILABLE high demand');
      return {
        rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.2 }],
        metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
      };
    });
    mockReasoning.generateSql
      .mockResolvedValueOnce('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre')
      .mockRejectedValueOnce(new Error('Forbidden SQL keyword: DROP'));

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented in our catalog?');
    expect(result.fallback).toBe(true);
  });

  it('stringifies non-Error execute failures and retries', async () => {
    let selects = 0;
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      selects += 1;
      if (selects === 1) throw 'busy';
      return {
        rows: [{ genre: 'Thriller', cnt: 3 }],
        metadata: { rowCount: 1, latencyMs: 1, partner: 'clickhouse' }
      };
    });
    mockReasoning.generateSql
      .mockResolvedValueOnce('SELECT 1 WHERE 0')
      .mockResolvedValueOnce('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre');

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented?');
    expect(result.queryRows).toEqual([{ genre: 'Thriller', cnt: 3 }]);
  });

  it('rethrows SYNTHESIZE errors that are not Gemini outages', async () => {
    mockReasoning.synthesize.mockRejectedValue(new Error('malformed writer payload'));
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    await expect(runner.run('Which genre is under-represented?')).rejects.toThrow(/malformed writer/);
  });

  it('does not fall back when ingest PLAN_SQL hits a Gemini outage', async () => {
    mockReasoning.classifyIntent.mockResolvedValue('ingest' as AgentIntent);
    mockReasoning.generateSql.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    await expect(runner.run('ingest this title')).rejects.toThrow(/RESOURCE_EXHAUSTED/);
  });

  it('uses defaultIntent catalog_qa without classifying', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Which genre is under-represented?', { defaultIntent: 'catalog_qa' });
    expect(result.intent).toBe('catalog_qa');
    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
  });

  it('rethrows classifyIntent errors that are not Gemini outages', async () => {
    mockReasoning.classifyIntent.mockRejectedValue(new Error('classifier exploded'));
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    await expect(runner.run('Which genre?')).rejects.toThrow(/classifier exploded/);
  });

  it('remaps a greenlight classification for catalog Q&A briefs', async () => {
    mockReasoning.classifyIntent.mockResolvedValue('greenlight' as AgentIntent);
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Recommend a feel-good comedy under 2 hours');
    expect(result.intent).toBe('catalog_qa');
    expect(result.sql).toMatch(/genre = 'Comedy'/);
  });

  it('keeps greenlight intent for the weekly slate phrasing', async () => {
    mockReasoning.classifyIntent.mockResolvedValue('greenlight' as AgentIntent);
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('run greenlight weekly slate');
    expect(result.intent).toBe('greenlight');
  });

  it('grounds comedy and revenue-genre asks when Gemini is unavailable', async () => {
    mockReasoning.classifyIntent.mockRejectedValue(new Error('Gemini API credits exhausted (429)'));
    mockReasoning.generateSql.mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));
    mockReasoning.synthesize.mockRejectedValue(new Error('quota exceeded'));
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes("genre = 'Comedy'")) {
        return {
          rows: [{ title: 'Sunday Laughs', genre: 'Comedy', revenue_usd: 400, description: 'warm' }],
          metadata: { rowCount: 1, latencyMs: 8, partner: 'clickhouse' }
        };
      }
      if (sql.includes('gap_score')) {
        return {
          rows: [
            {
              hole_type: 'genre',
              dimension: 'Thriller',
              gap_score: 0.07,
              title_share: 0.075,
              revenue_share: 0.144
            }
          ],
          metadata: { rowCount: 1, latencyMs: 8, partner: 'clickhouse' }
        };
      }
      return {
        rows: [{ genre: 'Animation', title_count: 10, revenue_4w: 50 }],
        metadata: { rowCount: 1, latencyMs: 8, partner: 'clickhouse' }
      };
    });

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const comedy = await runner.run('Recommend a feel-good comedy under 2 hours');
    const revenue = await runner.run('Which genre should we greenlight next based on recent revenue?');

    expect(comedy.sql).toMatch(/genre = 'Comedy'/);
    expect(comedy.answer).toMatch(/Sunday Laughs/);
    expect(comedy.answer).not.toMatch(/fewest titles/);
    expect(comedy.queryRows).toHaveLength(1);

    expect(revenue.sql).toMatch(/gap_score/i);
    expect(revenue.answer).toMatch(/Thriller/);
    expect(revenue.answer).not.toMatch(/fewest titles/);
    expect(revenue.answer).not.toBe(comedy.answer);
  });

  it('replaces Gemini genre-inventory SQL when the user asked for comedies', async () => {
    mockReasoning.generateSql.mockResolvedValue(
      'SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre'
    );
    mockMcp.runQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('system.columns')) {
        return { rows: schemaRows, metadata: { rowCount: 2, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes('INSERT INTO')) {
        return { rows: [], metadata: { rowCount: 0, latencyMs: 1, partner: 'clickhouse' } };
      }
      if (sql.includes("genre = 'Comedy'")) {
        return {
          rows: [{ title: 'Harbor Jokes', genre: 'Comedy', revenue_usd: 90 }],
          metadata: { rowCount: 1, latencyMs: 8, partner: 'clickhouse' }
        };
      }
      return {
        rows: [{ genre: 'Animation', cnt: 10 }],
        metadata: { rowCount: 1, latencyMs: 8, partner: 'clickhouse' }
      };
    });

    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test', mockAudit);
    const result = await runner.run('Recommend a feel-good comedy under 2 hours');
    expect(result.fallback).toBe(true);
    expect(result.sql).toMatch(/genre = 'Comedy'/);
    expect(result.queryRows[0]).toMatchObject({ title: 'Harbor Jokes' });
  });
});
