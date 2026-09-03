import {
  escapeSqlLiteral,
  runAgentStep,
  AgentStep,
  DomainEventPublisher,
  MediaContentCreated,
  WorkflowId,
  DomainError,
  MediaContent,
  MediaIngestionService,
  CatalogQueryService,
  InsightEngineService,
  ICatalogRepository,
  ContentIngestionUseCase,
  MediaEnrichment,
  validateGeneratedSql,
  SqlValidationError
} from '@bas/core';

describe('escapeSqlLiteral', () => {
  it('doubles single quotes', () => {
    expect(escapeSqlLiteral("gemini'--")).toBe("gemini''--");
  });
});

describe('runAgentStep', () => {
  it('records completed output', async () => {
    const steps: AgentStep[] = [];
    const value = await runAgentStep(steps, 'INTENT', async () => ({ ok: true }));
    expect(value).toEqual({ ok: true });
    expect(steps[0].status).toBe('completed');
  });

  it('records error and rethrows', async () => {
    const steps: AgentStep[] = [];
    await expect(
      runAgentStep(steps, 'EXECUTE', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    expect(steps[0].status).toBe('error');
    expect(steps[0].error).toBe('boom');
  });

  it('stringifies non-Error throws', async () => {
    const steps: AgentStep[] = [];
    await expect(
      runAgentStep(steps, 'INTENT', async () => {
        throw 'nope';
      })
    ).rejects.toBe('nope');
    expect(steps[0].error).toBe('nope');
  });
});

describe('DomainEventPublisher', () => {
  it('delivers subscribed events by constructor name', () => {
    const publisher = new DomainEventPublisher();
    const seen: string[] = [];
    publisher.subscribe('MediaContentCreated', event => {
      seen.push((event as MediaContentCreated).title);
    });
    publisher.subscribe('MediaContentCreated', event => {
      seen.push(`again:${(event as MediaContentCreated).title}`);
    });
    publisher.publish(new MediaContentCreated('id-1', 'Inception', 'Sci-Fi'));
    expect(seen).toEqual(['Inception', 'again:Inception']);
  });

  it('ignores events with no subscribers', () => {
    const publisher = new DomainEventPublisher();
    expect(() => publisher.publish(new MediaContentCreated('id-1', 'X', 'Drama'))).not.toThrow();
  });
});

describe('WorkflowId', () => {
  it('creates unique ids', () => {
    expect(WorkflowId.create().value).not.toBe(WorkflowId.create().value);
  });

  it('parses and compares', () => {
    const a = WorkflowId.fromString('abc');
    const b = WorkflowId.fromString('abc');
    expect(a.equals(b)).toBe(true);
    expect(a.toString()).toBe('abc');
  });

  it('rejects empty strings', () => {
    expect(() => WorkflowId.fromString('  ')).toThrow(DomainError);
  });
});

describe('MediaContent events', () => {
  it('emits MediaContentCreated on factory create', () => {
    const content = MediaContent.create('Title', 'Description here', 'Drama', '2020-01-01', ['Actor']);
    expect(content.hasUncommittedEvents()).toBe(true);
    const events = content.pullDomainEvents();
    expect(events[0]).toBeInstanceOf(MediaContentCreated);
    expect(content.pullDomainEvents()).toEqual([]);
  });
});

describe('sqlValidation extra', () => {
  it('rejects empty SQL', () => {
    expect(() => validateGeneratedSql('   ', 'catalog_qa')).toThrow(SqlValidationError);
  });

  it('blocks additional forbidden keywords', () => {
    expect(() => validateGeneratedSql('CREATE TABLE x (id Int)', 'catalog_qa')).toThrow(SqlValidationError);
    expect(() => validateGeneratedSql('CREATE DATABASE x', 'catalog_qa')).toThrow(SqlValidationError);
  });

  it('allows WITH for catalog_qa', () => {
    expect(() =>
      validateGeneratedSql('WITH x AS (SELECT 1) SELECT * FROM x', 'catalog_qa')
    ).not.toThrow();
  });

  it('rejects SELECT for ingest', () => {
    expect(() => validateGeneratedSql('SELECT 1', 'ingest')).toThrow(SqlValidationError);
  });
});

describe('application services', () => {
  const catalog: jest.Mocked<ICatalogRepository> = {
    insert: jest.fn(),
    list: jest.fn(),
    stats: jest.fn(),
    genreDistribution: jest.fn(),
    similarTitles: jest.fn()
  };

  const gemini = {
    enrich: jest.fn().mockResolvedValue(MediaEnrichment.create('Summary', ['tag'], 'positive'))
  };

  beforeEach(() => {
    jest.clearAllMocks();
    catalog.insert.mockResolvedValue({ storedRows: 1, partner: 'clickhouse', latencyMs: 4 });
    catalog.list.mockResolvedValue([]);
    catalog.stats.mockResolvedValue({
      totalEntries: 0,
      genres: {},
      recentAdditions: 0,
      topCast: []
    });
    catalog.genreDistribution.mockResolvedValue([{ genre: 'Drama', cnt: 2 }]);
    catalog.similarTitles.mockResolvedValue([{ title: 'Other', genre: 'Drama' }]);
  });

  it('ingests via repository and publishes domain events', async () => {
    const published: string[] = [];
    const service = new MediaIngestionService(catalog, gemini, {
      publish: event => published.push(event.constructor.name),
      subscribe: jest.fn()
    });
    const content = MediaContent.create('Film', 'A long enough description', 'Drama', '2020-01-01', ['A']);
    const result = await service.process(content);
    expect(result.success).toBe(true);
    expect(catalog.insert).toHaveBeenCalled();
    expect(published).toContain('MediaContentCreated');
    expect(published).toContain('MediaEnrichmentCompleted');
  });

  it('lists catalog and stats through CatalogQueryService', async () => {
    const queries = new CatalogQueryService(catalog);
    await queries.getCatalog();
    await queries.getCatalogStats();
    expect(catalog.list).toHaveBeenCalled();
    expect(catalog.stats).toHaveBeenCalled();
  });

  it('generateInsight uses catalog analytics then Gemini', async () => {
    const engine = new InsightEngineService(catalog, gemini);
    const result = await engine.generateInsight({
      title: 'New',
      description: 'Desc',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A'],
      insightPrompt: 'Prime-time slot'
    });
    expect(gemini.enrich).toHaveBeenCalledWith(expect.objectContaining({
      description: expect.stringContaining('Prime-time slot')
    }));
    expect(result.success).toBe(true);
    expect(result.insights).toBe('Summary');
    expect(catalog.genreDistribution).toHaveBeenCalled();
    expect(catalog.similarTitles).toHaveBeenCalledWith('Drama', 5);
  });

  it('generateInsight defaults the prompt when none is provided', async () => {
    const engine = new InsightEngineService(catalog, gemini);
    await engine.generateInsight({
      title: 'New',
      description: 'Desc',
      genre: 'Drama',
      releaseDate: '2020-01-01',
      cast: ['A']
    });
    expect(gemini.enrich).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining('Programming recommendation')
      })
    );
  });

  it('ContentIngestionUseCase creates entity then processes', async () => {
    const service = new MediaIngestionService(catalog, gemini);
    const useCase = new ContentIngestionUseCase(service);
    const result = await useCase.execute({
      title: 'Ingest me',
      description: 'Description of title',
      genre: 'Comedy',
      releaseDate: '2020-01-01',
      cast: ['Star']
    });
    expect(result.success).toBe(true);
  });
});
