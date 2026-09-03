import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, fetchJson } from './api';
import { ApiError } from './utils/apiErrors';

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes('/health')) {
          return new Response(JSON.stringify({ status: 'ok', ready: true }), { status: 200 });
        }
        if (url.includes('/catalog/stats')) {
          return new Response(JSON.stringify({ totalEntries: 200, genres: {} }), { status: 200 });
        }
        if (url.includes('/catalog')) {
          return new Response(JSON.stringify({ entries: [], count: 0 }), { status: 200 });
        }
        if (url.includes('/agent/ask')) {
          return new Response(JSON.stringify({ answer: 'ok', steps: [], totalLatencyMs: 1, model: 'x', intent: 'catalog_qa' }), { status: 200 });
        }
        if (url.includes('/media/ingest')) {
          return new Response(JSON.stringify({ contentId: 'c1', latencyMs: 2 }), { status: 200 });
        }
        return new Response('quota', { status: 429 });
      })
    );
    await expect(api.health()).resolves.toMatchObject({ ready: true });
    await expect(api.getStats()).resolves.toMatchObject({ totalEntries: 200 });
    await expect(api.getCatalog()).resolves.toMatchObject({ count: 0 });
    await expect(api.ask('q')).resolves.toMatchObject({ answer: 'ok' });
    await expect(
      api.ingest({ title: 'T', description: 'D', genre: 'Drama', releaseDate: '2020-01-01', cast: ['A'] })
    ).resolves.toMatchObject({ contentId: 'c1' });
  });

  it('maps HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('quota', { status: 429 })));
    await expect(api.getGreenlight()).rejects.toBeInstanceOf(ApiError);
  });

  it('maps abort to a timeout error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      })
    );
    await expect(api.health()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('uses default timeout and rethrows non-Error failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));
    await expect(fetchJson('/health')).resolves.toEqual({ ok: true });

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw 'socket down';
    }));
    await expect(api.health()).rejects.toBe('socket down');

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('socket down');
    }));
    await expect(api.health()).rejects.toThrow('socket down');
  });
});
