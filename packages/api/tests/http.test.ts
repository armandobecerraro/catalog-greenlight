import request from 'supertest';
import { createApp, forwardSendFileError } from '../src/createApp';
import { ApiRuntime } from '../src/runtime';
import { GreenlightCache } from '../src/greenlightCache';
import { requireApiKey } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/errorHandler';
import { DomainError } from '@bas/core';
import { Request, Response } from 'express';

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function sampleRuntime(overrides: Partial<ApiRuntime> = {}): ApiRuntime {
  const greenlight = {
    runId: 'r1',
    intent: 'greenlight' as const,
    userPrompt: 'p',
    answer: 'ok',
    recommendations: [
      {
        title: 'Crimen sin Fronteras: Bogotá',
        genre: 'Thriller',
        justification: 'breakout',
        evidence: 'wow',
        opportunity_score: 0.26,
        wow_pct: 0.32,
        genre_gap: 0.13
      }
    ],
    steps: [],
    totalLatencyMs: 10,
    model: 'gemini-test'
  };

  return {
    ingestionUseCase: {
      execute: jest.fn().mockResolvedValue({ contentId: 'c1', latencyMs: 5, success: true })
    },
    catalogQueries: {
      getCatalog: jest.fn().mockResolvedValue([{ id: '1', title: 'T', description: 'D', genre: 'Drama', releaseDate: '2020-01-01', cast: ['A'], enrichment: null }]),
      getCatalogStats: jest.fn().mockResolvedValue({ totalEntries: 200, genres: { Drama: 10 }, recentAdditions: 2, topCast: [] })
    },
    agentRunner: {
      run: jest.fn().mockResolvedValue({ ...greenlight, intent: 'catalog_qa', answer: 'Thriller gap' }),
      runGreenlight: jest.fn().mockResolvedValue(greenlight)
    },
    isReady: () => true,
    initError: () => null,
    health: () => ({
      status: 'ok',
      product: 'Catalog Greenlight',
      ready: true,
      error: null,
      timestamp: new Date().toISOString(),
      partners: { clickhouse: 'connected', mcp: 'mcp-clickhouse', gemini: 'gemini-test' }
    }),
    apiKeyRequired: false,
    ...overrides
  };
}

describe('createApp HTTP', () => {
  it('serves health without ready gate', async () => {
    const app = createApp(sampleRuntime());
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('returns 503 when not ready', async () => {
    const app = createApp(sampleRuntime({ isReady: () => false, initError: () => 'booting' }));
    const res = await request(app).get('/api/v1/catalog/stats');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/booting/);
  });

  it('returns a generic initializing message when no init error is set', async () => {
    const app = createApp(sampleRuntime({ isReady: () => false, initError: () => null }));
    const res = await request(app).get('/api/v1/catalog');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/initializing/i);
  });

  it('honors in-place runtime swap after listen (production startup)', async () => {
    const runtime = sampleRuntime({ isReady: () => false, initError: () => null });
    const app = createApp(runtime);
    expect((await request(app).get('/api/v1/greenlight')).status).toBe(503);
    expect((await request(app).get('/api/v1/health')).body.ready).toBe(true);

    Object.assign(runtime, sampleRuntime());
    const gl = await request(app).get('/api/v1/greenlight');
    expect(gl.status).toBe(200);
    expect(gl.body.recommendations[0].title).toMatch(/Bogotá/);
  });

  it('asks, lists catalog, stats, ingest, greenlight', async () => {
    const runtime = sampleRuntime();
    const app = createApp(runtime);
    expect((await request(app).post('/api/v1/agent/ask').send({})).status).toBe(400);
    const ask = await request(app).post('/api/v1/agent/ask').send({ question: 'Which genre?' });
    expect(ask.status).toBe(200);
    expect(ask.body.answer).toMatch(/Thriller/);

    const catalog = await request(app).get('/api/v1/catalog');
    expect(catalog.body.count).toBe(1);

    const stats = await request(app).get('/api/v1/catalog/stats');
    expect(stats.body.totalEntries).toBe(200);

    const ingest = await request(app).post('/api/v1/media/ingest').send({ title: 'T' });
    expect(ingest.status).toBe(201);

    const gl = await request(app).get('/api/v1/greenlight');
    expect(gl.body.cached).toBe(false);
    expect(gl.body.recommendations[0].opportunity_score).toBe(0.26);

    const cached = await request(app).get('/api/v1/greenlight');
    expect(cached.body.cached).toBe(true);
    expect(runtime.agentRunner.runGreenlight).toHaveBeenCalledTimes(1);

    const refresh = await request(app).get('/api/v1/greenlight?refresh=1');
    expect(refresh.body.cached).toBe(false);
    expect(runtime.agentRunner.runGreenlight).toHaveBeenCalledTimes(2);
  });

  it('maps unknown API routes to 404', async () => {
    const app = createApp(sampleRuntime());
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
  });

  it('maps Gemini quota errors to 429', async () => {
    const runtime = sampleRuntime({
      agentRunner: {
        run: jest.fn().mockRejectedValue(new Error('RESOURCE_EXHAUSTED quota')),
        runGreenlight: jest.fn()
      }
    });
    const app = createApp(runtime);
    const res = await request(app).post('/api/v1/agent/ask').send({ question: 'hi' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('gemini_billing');
  });

  it('maps ask failures to 500', async () => {
    const runtime = sampleRuntime({
      agentRunner: {
        run: jest.fn().mockRejectedValue(new Error('ask exploded')),
        runGreenlight: jest.fn()
      }
    });
    const app = createApp(runtime);
    const res = await request(app).post('/api/v1/agent/ask').send({ question: 'hi' });
    expect(res.status).toBe(500);
  });

  it('maps DomainError to 400', async () => {
    const runtime = sampleRuntime({
      ingestionUseCase: {
        execute: jest.fn().mockRejectedValue(new DomainError('Title cannot be empty', 'EMPTY_TITLE'))
      }
    });
    const app = createApp(runtime);
    const res = await request(app).post('/api/v1/media/ingest').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EMPTY_TITLE');
  });

  it('requires API key when configured', async () => {
    const previous = process.env.API_KEY;
    process.env.API_KEY = 'secret';
    const app = createApp(sampleRuntime({ apiKeyRequired: true }));
    expect((await request(app).get('/api/v1/catalog')).status).toBe(401);
    expect((await request(app).get('/api/v1/catalog').set('x-api-key', 'secret')).status).toBe(200);
    expect((await request(app).get('/api/v1/health')).status).toBe(200);
    process.env.API_KEY = previous;
  });

  it('bypasses greenlight cache with Cache-Control', async () => {
    const runtime = sampleRuntime();
    const app = createApp(runtime);
    await request(app).get('/api/v1/greenlight');
    const bypass = await request(app).get('/api/v1/greenlight').set('Cache-Control', 'no-cache');
    expect(bypass.body.cached).toBe(false);
    expect(runtime.agentRunner.runGreenlight).toHaveBeenCalledTimes(2);
  });

  it('maps empty errors to 500', async () => {
    const runtime = sampleRuntime({
      catalogQueries: {
        getCatalog: jest.fn().mockRejectedValue(new Error('')),
        getCatalogStats: jest.fn()
      }
    });
    const app = createApp(runtime);
    const res = await request(app).get('/api/v1/catalog');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('maps greenlight and stats failures to 500', async () => {
    const runtime = sampleRuntime({
      catalogQueries: {
        getCatalog: jest.fn(),
        getCatalogStats: jest.fn().mockRejectedValue(new Error('stats exploded'))
      },
      agentRunner: {
        run: jest.fn(),
        runGreenlight: jest.fn().mockRejectedValue(new Error('greenlight exploded'))
      }
    });
    const app = createApp(runtime);
    const stats = await request(app).get('/api/v1/catalog/stats');
    expect(stats.status).toBe(500);
    const gl = await request(app).get('/api/v1/greenlight');
    expect(gl.status).toBe(500);
  });

  it('falls through missing SPA files to the error handler', async () => {
    const app = createApp(sampleRuntime());
    expect((await request(app).get('/not-an-api-route')).status).toBeGreaterThanOrEqual(200);
    expect((await request(app).get('/api')).status).toBeGreaterThanOrEqual(200);
  });
});

describe('forwardSendFileError', () => {
  it('forwards errors and ignores a clean sendFile callback', () => {
    const next = jest.fn();
    forwardSendFileError(undefined, next);
    expect(next).not.toHaveBeenCalled();
    const err = new Error('ENOENT');
    forwardSendFileError(err, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('requireApiKey', () => {
  const original = process.env.API_KEY;

  afterEach(() => {
    process.env.API_KEY = original;
  });

  it('rejects missing or wrong keys', () => {
    process.env.API_KEY = 'secret';
    const res = mockRes();
    requireApiKey({ headers: {} } as Request, res, jest.fn());
    expect(res.statusCode).toBe(401);

    const next = jest.fn();
    requireApiKey({ headers: { 'x-api-key': 'secret' } } as unknown as Request, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects array API key headers', () => {
    process.env.API_KEY = 'secret';
    const res = mockRes();
    requireApiKey({ headers: { 'x-api-key': ['secret'] } } as unknown as Request, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });

  it('rejects when API_KEY is unset', () => {
    delete process.env.API_KEY;
    const res = mockRes();
    requireApiKey({ headers: { 'x-api-key': 'secret' } } as unknown as Request, res, jest.fn());
    expect(res.statusCode).toBe(401);
  });
});

describe('errorHandler', () => {
  it('returns 500 for generic errors', () => {
    const res = mockRes();
    errorHandler(new Error('nope'), {} as Request, res, jest.fn());
    expect(res.statusCode).toBe(500);
  });

  it('returns 500 when the error has no message', () => {
    const res = mockRes();
    errorHandler(new Error(''), {} as Request, res, jest.fn());
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});

describe('GreenlightCache', () => {
  it('coalesces in-flight fetches', async () => {
    let resolveRun: (value: { answer: string }) => void = () => undefined;
    const runner = {
      runGreenlight: jest.fn(
        () =>
          new Promise<{ answer: string }>(resolve => {
            resolveRun = resolve;
          })
      )
    };
    const cache = new GreenlightCache(runner as never, 60_000);
    const a = cache.get();
    const b = cache.get();
    resolveRun({ answer: 'ok' });
    await expect(Promise.all([a, b])).resolves.toEqual([{ answer: 'ok' }, { answer: 'ok' }]);
    expect(runner.runGreenlight).toHaveBeenCalledTimes(1);
  });

  it('bypasses on refresh flags', () => {
    const cache = new GreenlightCache({ runGreenlight: jest.fn() });
    expect(cache.shouldBypass('1')).toBe(true);
    expect(cache.shouldBypass('true')).toBe(true);
    expect(cache.shouldBypass(undefined, 'no-store')).toBe(true);
    expect(cache.shouldBypass()).toBe(false);
  });

  it('returns cached results until TTL expires', async () => {
    jest.useFakeTimers();
    const runner = { runGreenlight: jest.fn().mockResolvedValue({ answer: 'cached' }) };
    const cache = new GreenlightCache(runner as never, 1_000);
    await expect(cache.get()).resolves.toEqual({ answer: 'cached' });
    await expect(cache.get()).resolves.toEqual({ answer: 'cached' });
    expect(runner.runGreenlight).toHaveBeenCalledTimes(1);
    expect(cache.peek()).not.toBeNull();
    jest.advanceTimersByTime(1_001);
    expect(cache.peek()).toBeNull();
    await cache.get(true);
    expect(runner.runGreenlight).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
