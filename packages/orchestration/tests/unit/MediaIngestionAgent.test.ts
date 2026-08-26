import { MediaIngestionAgent } from '../../src/agents/MediaIngestionAgent';
import { MediaContent, IGeminiEnrichmentPort, IMcpConnector } from '@bas/core';
import { MediaEnrichment } from '@bas/core';

describe('MediaIngestionAgent', () => {
  const fakeGemini: IGeminiEnrichmentPort = {
    enrich: jest.fn().mockResolvedValue(
      MediaEnrichment.create('Test summary', ['sci-fi', 'thriller'], 'positive')
    )
  };

  const mockMcp: jest.Mocked<IMcpConnector> = {
    name: 'clickhouse-mcp',
    connect: jest.fn(),
    disconnect: jest.fn(),
    query: jest.fn(),
    stream: jest.fn(),
    listDatabases: jest.fn(),
    listTables: jest.fn(),
    runQuery: jest.fn().mockResolvedValue({
      rows: [],
      metadata: { rowCount: 1, latencyMs: 20, partner: 'clickhouse' }
    })
  };

  it('enriches and persists via MCP with real latency', async () => {
    const agent = new MediaIngestionAgent(mockMcp, fakeGemini);
    const content = MediaContent.create(
      'Test Title',
      'A test description for ingestion',
      'Sci-Fi',
      '2020-01-01',
      ['Actor One']
    );

    const state = await agent.execute(content);

    expect(state.step).toBe(3);
    expect(state.enrichment).toBeDefined();
    expect(state.storageResult?.success).toBe(true);
    expect(state.storageResult?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(mockMcp.runQuery).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO media_catalog.media_content'));
    expect(state.errors).toHaveLength(0);
  });

  it('handles missing content', async () => {
    const agent = new MediaIngestionAgent(mockMcp, fakeGemini);
    const state = await agent.execute(null as unknown as MediaContent);
    expect(state.errors).toContain('No content provided');
  });
});
