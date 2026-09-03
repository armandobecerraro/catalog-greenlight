import { FakeGeminiEnrichmentClient } from '../../src/gemini/FakeGeminiEnrichmentClient';

describe('FakeGeminiEnrichmentClient', () => {
  let client: FakeGeminiEnrichmentClient;

  beforeEach(() => {
    client = new FakeGeminiEnrichmentClient();
  });

  it('should enrich action content correctly', async () => {
    const result = await client.enrich({
      title: 'Explosive Showdown',
      description: 'Hero faces villain in epic battle',
      genre: 'Action',
      releaseDate: '2024-01-01',
      cast: ['Actor One', 'Actor Two']
    });

    expect(result.summary).toContain('action');
    expect(result.tags).toContain('action');
    expect(result.tags).toContain('thriller');
    expect(result.sentiment).toBe('positive');
    expect(result.summary).toContain('Explosive Showdown');
  });

  it('should enrich drama content with appropriate tags', async () => {
    const result = await client.enrich({
      title: 'Life Changing Moments',
      description: 'Character journey through life',
      genre: 'Drama',
      releaseDate: '2024-06-15',
      cast: ['Actor A', 'Actor B', 'Actor C']
    });

    expect(result.tags).toContain('drama');
    expect(result.tags).toContain('emotional');
    expect(result.tags).toContain('cast-3');
  });

  it('should include title in summary', async () => {
    const result = await client.enrich({
      title: 'The Matrix',
      description: 'A computer hacker learns about reality',
      genre: 'Sci-Fi',
      releaseDate: '1999-03-31',
      cast: ['Keanu Reeves', 'Carrie-Anne Moss']
    });

    expect(result.summary).toContain('The Matrix');
    expect(result.tags).toContain('sci-fi');
  });

  it('falls back for unknown genres and substring matches', async () => {
    const unknown = await client.enrich({
      title: 'Unknown Title',
      description: 'x',
      genre: 'Documentary',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(unknown.summary).toContain('Unknown Title');
    expect(unknown.summary.toLowerCase()).toMatch(/documentary/);

    const nested = await client.enrich({
      title: 'Night',
      description: 'x',
      genre: 'dark-horror-feature',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(nested.tags).toContain('horror');
  });

  it('reuses existing tags and simulates latency outside tests', async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.useFakeTimers();
    try {
      const pending = client.enrich({
        title: 'action extra',
        description: 'x',
        genre: 'Action',
        releaseDate: '2020-01-01',
        cast: ['A']
      });
      await jest.advanceTimersByTimeAsync(300);
      const result = await pending;
      expect(result.tags.filter(t => t === 'action')).toHaveLength(1);
      expect(result.tags).toContain('extra');
    } finally {
      process.env.NODE_ENV = original;
      jest.useRealTimers();
    }
  });
});
