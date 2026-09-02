import { MediaIngestionAgent } from '../../src/agents/MediaIngestionAgent';
import { MediaContent, IMediaIngestionService } from '@bas/core';
import { MediaEnrichment } from '@bas/core';

describe('MediaIngestionAgent', () => {
  const mockIngestion: jest.Mocked<IMediaIngestionService> = {
    process: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates enrich+persist to MediaIngestionService', async () => {
    const content = MediaContent.create(
      'Test Title',
      'A test description for ingestion',
      'Sci-Fi',
      '2020-01-01',
      ['Actor One']
    );
    content.applyEnrichment(MediaEnrichment.create('Test summary', ['sci-fi'], 'positive'));
    mockIngestion.process.mockResolvedValue({
      success: true,
      contentId: content.id,
      storedRows: 1,
      partner: 'clickhouse',
      latencyMs: 12
    });

    const agent = new MediaIngestionAgent(mockIngestion);
    const state = await agent.execute(content);

    expect(state.step).toBe(3);
    expect(state.enrichment?.summary).toBe('Test summary');
    expect(state.storageResult?.success).toBe(true);
    expect(mockIngestion.process).toHaveBeenCalledWith(content);
    expect(state.errors).toHaveLength(0);
  });

  it('handles missing content', async () => {
    const agent = new MediaIngestionAgent(mockIngestion);
    const state = await agent.execute(null);
    expect(state.errors).toContain('No content provided');
    expect(mockIngestion.process).not.toHaveBeenCalled();
  });

  it('returns errors when ingestion fails', async () => {
    const content = MediaContent.create('T', 'Desc for ingest', 'Drama', '2020-01-01', ['A']);
    mockIngestion.process.mockRejectedValue(new Error('MCP down'));
    const agent = new MediaIngestionAgent(mockIngestion);
    const state = await agent.execute(content);
    expect(state.errors).toContain('MCP down');
    expect(state.step).toBe(0);
  });

  it('stringifies non-Error ingestion failures', async () => {
    const content = MediaContent.create('T', 'Desc for ingest', 'Drama', '2020-01-01', ['A']);
    mockIngestion.process.mockRejectedValue('boom');
    const agent = new MediaIngestionAgent(mockIngestion);
    const state = await agent.execute(content);
    expect(state.errors).toContain('Unknown error');
  });
});
