import { generateGeminiText } from '../../src/gemini/generateContent';
import { GeminiReasoningAdapter, parseRecommendations } from '../../src/gemini/GeminiReasoningAdapter';
import { GeminiEnrichmentAdapter } from '../../src/gemini/GeminiEnrichmentAdapter';
import { GeminiClientFactory } from '../../src/gemini/GeminiClientFactory';
import { resolveGeminiApiKey } from '../../src/gemini/resolveGeminiApiKey';

jest.mock('../../src/gemini/generateContent', () => ({
  generateGeminiText: jest.fn()
}));

const generate = generateGeminiText as jest.MockedFunction<typeof generateGeminiText>;

describe('resolveGeminiApiKey', () => {
  const original = process.env;

  afterEach(() => {
    process.env = original;
  });

  it('prefers GEMINI_API_KEY', () => {
    process.env = { ...original, GEMINI_API_KEY: ' abc ' };
    expect(resolveGeminiApiKey()).toBe('abc');
  });

  it('falls back to GOOGLE_API_KEY', () => {
    process.env = { ...original };
    delete process.env.GEMINI_API_KEY;
    process.env.GOOGLE_API_KEY = 'gkey';
    expect(resolveGeminiApiKey()).toBe('gkey');
  });

  it('throws when missing', () => {
    process.env = { ...original };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    expect(() => resolveGeminiApiKey()).toThrow(/GEMINI_API_KEY is required/);
  });

  it('falls back to GOOGLE_GENERATIVE_AI_API_KEY and rejects blank keys', () => {
    process.env = { ...original };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'gen-key';
    expect(resolveGeminiApiKey()).toBe('gen-key');
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = '   ';
    expect(() => resolveGeminiApiKey()).toThrow(/GEMINI_API_KEY is required/);
  });
});

describe('parseRecommendations', () => {
  it('keeps titled objects and drops junk', () => {
    expect(parseRecommendations(null)).toEqual([]);
    expect(
      parseRecommendations([{ title: 'A', genre: 'Drama', justification: 'j', evidence: 'e' }, { no: 'title' }])
    ).toHaveLength(1);
  });
});

describe('GeminiReasoningAdapter', () => {
  beforeEach(() => {
    generate.mockReset();
  });

  it('classifies intents from free text', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce('greenlight');
    await expect(adapter.classifyIntent('picks')).resolves.toBe('greenlight');
    expect(generate.mock.calls[0][1]).toMatch(/weekly 3-pick/);
    generate.mockResolvedValueOnce('stats please');
    await expect(adapter.classifyIntent('picks')).resolves.toBe('stats');
    generate.mockResolvedValueOnce('ingest title');
    await expect(adapter.classifyIntent('picks')).resolves.toBe('ingest');
    generate.mockResolvedValueOnce('something else');
    await expect(adapter.classifyIntent('picks')).resolves.toBe('catalog_qa');
  });

  it('strips markdown from SQL', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce('```sql\nSELECT 1\n```');
    await expect(adapter.generateSql('catalog_qa', 'q', 'schema')).resolves.toBe('SELECT 1');
  });

  it('includes retry context when regenerating SQL', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce('SELECT 2');
    await adapter.generateSql('catalog_qa', 'q', 'schema', {
      previousSql: 'SELECT 0',
      errorOrEmpty: '0 rows'
    });
    expect(generate.mock.calls[0][1]).toMatch(/Previous SQL failed/);
  });

  it('tells the planner not to invent duration or inventory SQL for title asks', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce('SELECT 1');
    await adapter.generateSql('catalog_qa', 'Recommend a feel-good comedy under 2 hours', 'schema');
    expect(generate.mock.calls[0][1]).toMatch(/NO duration\/runtime/);
    expect(generate.mock.calls[0][1]).toMatch(/never a genre inventory GROUP BY/);
  });

  it('allows INSERT wording for ingest intent', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce('INSERT INTO media_catalog.media_content (id) VALUES (1)');
    await expect(adapter.generateSql('ingest', 'add title', 'schema')).resolves.toMatch(/^INSERT/);
    expect(generate.mock.calls[0][1]).toMatch(/INSERT is allowed/);
  });

  it('parses synthesis JSON and falls back to raw text', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce(
      JSON.stringify({
        answer: 'ok',
        recommendations: [{ title: 'T', genre: 'Drama', justification: 'j', evidence: 'e' }]
      })
    );
    const parsed = await adapter.synthesize('catalog_qa', 'q', 'SELECT 1', []);
    expect(parsed.answer).toBe('ok');
    expect(parsed.recommendations?.[0].title).toBe('T');
    expect(generate.mock.calls[0][1]).toMatch(/Never answer a different question/);

    generate.mockResolvedValueOnce('not-json');
    const raw = await adapter.synthesizeGreenlight('q', 'SELECT 1', []);
    expect(raw.answer).toBe('not-json');

    generate.mockResolvedValueOnce(
      JSON.stringify({
        answer: 'weekly memo',
        recommendations: [{ title: 'T', genre: 'Drama', justification: 'j', evidence: 'e' }]
      })
    );
    const greenlight = await adapter.synthesizeGreenlight('q', 'SELECT 1', [
      { title: 'T', genre: 'Drama', opportunity_score: 0.2 }
    ]);
    expect(greenlight.answer).toBe('weekly memo');
    expect(greenlight.recommendations?.[0].title).toBe('T');
  });

  it('keeps raw text when JSON has no answer field', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce(JSON.stringify({ recommendations: [] }));
    const parsed = await adapter.synthesize('catalog_qa', 'q', 'SELECT 1', []);
    expect(parsed.answer).toContain('recommendations');
  });

  it('parses fenced JSON synthesis', async () => {
    const adapter = new GeminiReasoningAdapter('key');
    generate.mockResolvedValueOnce('```json\n{"answer":"fenced","recommendations":[]}\n```');
    const parsed = await adapter.synthesize('catalog_qa', 'q', 'SELECT 1', []);
    expect(parsed.answer).toBe('fenced');
  });
});

describe('GeminiEnrichmentAdapter', () => {
  beforeEach(() => {
    generate.mockReset();
  });

  it('parses JSON enrichment', async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ summary: 'Sum', tags: ['a', 'b'] }));
    const adapter = new GeminiEnrichmentAdapter('key');
    const result = await adapter.enrich({
      title: 'T',
      description: 'D',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(result.summary).toBe('Sum');
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('falls back when JSON is invalid', async () => {
    generate.mockResolvedValueOnce('plain line\ntag1');
    const adapter = new GeminiEnrichmentAdapter('key');
    const result = await adapter.enrich({
      title: 'T',
      description: 'D',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(result.summary).toContain('plain line');
  });

  it('falls back to genre tag when parsed tags are empty', async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ summary: 'Sum', tags: [] }));
    const adapter = new GeminiEnrichmentAdapter('key');
    const result = await adapter.enrich({
      title: 'T',
      description: 'D',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(result.tags).toEqual(['drama']);
  });

  it('uses default copy when JSON and text are empty', async () => {
    generate.mockResolvedValueOnce('');
    const adapter = new GeminiEnrichmentAdapter('key');
    const result = await adapter.enrich({
      title: 'T',
      description: 'D',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(result.summary).toMatch(/No summary available|Enrichment for T/);
  });

  it('uses title fallback when parsed summary is empty', async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ summary: '', tags: ['x'] }));
    const adapter = new GeminiEnrichmentAdapter('key');
    const result = await adapter.enrich({
      title: 'T',
      description: 'D',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(result.summary).toBe('Enrichment for T');
  });

  it('parses fenced JSON enrichment', async () => {
    generate.mockResolvedValueOnce('```json\n{"summary":"Fenced","tags":["a"]}\n```');
    const adapter = new GeminiEnrichmentAdapter('key');
    const result = await adapter.enrich({
      title: 'T',
      description: 'D',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(result.summary).toBe('Fenced');
  });
});

describe('GeminiClientFactory', () => {
  it('builds adapters with injected key resolver', () => {
    const factory = new GeminiClientFactory(() => 'k');
    expect(factory.createEnrichmentClient()).toBeDefined();
    expect(factory.createReasoningClient().modelName).toBeDefined();
  });

  it('uses resolveGeminiApiKey by default', () => {
    const original = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'env-key';
    const factory = new GeminiClientFactory();
    expect(factory.createReasoningClient()).toBeDefined();
    process.env.GEMINI_API_KEY = original;
  });

  it('reads GEMINI_MODEL on the reasoning adapter', () => {
    const original = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'gemini-custom';
    expect(new GeminiReasoningAdapter('k').modelName).toBe('gemini-custom');
    delete process.env.GEMINI_MODEL;
    expect(new GeminiReasoningAdapter('k').modelName).toBe('gemini-flash-latest');
    process.env.GEMINI_MODEL = original;
  });
});
