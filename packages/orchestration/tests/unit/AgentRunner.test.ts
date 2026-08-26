import { AgentRunner } from '../../src/agents/AgentRunner';
import { IMcpConnector, IGeminiReasoningPort, AgentIntent } from '@bas/core';

describe('AgentRunner', () => {
  const mockMcp: jest.Mocked<IMcpConnector> = {
    name: 'clickhouse-mcp',
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn(),
    stream: jest.fn(),
    listDatabases: jest.fn().mockResolvedValue(['media_catalog']),
    listTables: jest.fn().mockResolvedValue(['media_content', 'title_revenue']),
    runQuery: jest.fn()
  };

  const mockReasoning: jest.Mocked<IGeminiReasoningPort> = {
    classifyIntent: jest.fn().mockResolvedValue('catalog_qa' as AgentIntent),
    generateSql: jest.fn().mockResolvedValue('SELECT genre, count() AS cnt FROM media_catalog.media_content GROUP BY genre'),
    synthesize: jest.fn().mockResolvedValue({
      answer: 'Sci-Fi is under-represented with 8 titles.',
      recommendations: []
    })
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMcp.runQuery.mockResolvedValue({
      rows: [{ genre: 'Sci-Fi', cnt: 8 }, { genre: 'Drama', cnt: 12 }],
      metadata: { rowCount: 2, latencyMs: 12, partner: 'clickhouse' }
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
    expect(mockMcp.listTables).toHaveBeenCalledWith('media_catalog');
    expect(mockReasoning.generateSql).toHaveBeenCalled();
    expect(mockMcp.runQuery).toHaveBeenCalledTimes(2);
    expect(result.answer).toContain('Sci-Fi');
    expect(result.sql).toContain('SELECT');
  });

  it('uses defaultIntent when provided', async () => {
    const runner = new AgentRunner(mockMcp, mockReasoning, 'gemini-test');
    const result = await runner.run('greenlight picks', { defaultIntent: 'greenlight' });

    expect(mockReasoning.classifyIntent).not.toHaveBeenCalled();
    expect(result.intent).toBe('greenlight');
  });
});
