import { AgentRunResult } from '@bas/core';

export const GREENLIGHT_CACHE_TTL_MS = 10 * 60_000;

export type GreenlightRunner = {
  runGreenlight(): Promise<AgentRunResult>;
};

export class GreenlightCache {
  private cache: { result: AgentRunResult; expiresAt: number } | null = null;
  private inFlight: Promise<AgentRunResult> | null = null;

  constructor(
    private readonly runner: GreenlightRunner,
    private readonly ttlMs = GREENLIGHT_CACHE_TTL_MS
  ) {}

  shouldBypass(refresh?: unknown, cacheControl?: string): boolean {
    if (refresh === '1' || refresh === 'true') return true;
    return cacheControl === 'no-cache' || cacheControl === 'no-store';
  }

  peek(): { result: AgentRunResult; expiresAt: number } | null {
    if (!this.cache || Date.now() >= this.cache.expiresAt) return null;
    return this.cache;
  }

  async get(bypass = false): Promise<AgentRunResult> {
    const now = Date.now();
    if (!bypass && this.cache && now < this.cache.expiresAt) {
      return this.cache.result;
    }
    if (!bypass && this.inFlight) {
      return this.inFlight;
    }

    const agentPromise = this.runner.runGreenlight().then(result => {
      this.cache = { result, expiresAt: Date.now() + this.ttlMs };
      return result;
    });

    if (!bypass) {
      this.inFlight = agentPromise.finally(() => {
        this.inFlight = null;
      });
      return this.inFlight;
    }

    return agentPromise;
  }
}
