import type { AgentRunResult, Recommendation } from '../api';
import { ApiError, formatApiError } from './apiErrors';

export type GreenlightPhase = 'measuring' | 'scoring' | 'narrative';

const MEASURING_MS = 25_000;
const SCORING_MS = 45_000;

export function greenlightPhaseFromElapsed(elapsedMs: number): GreenlightPhase {
  if (elapsedMs < MEASURING_MS) return 'measuring';
  if (elapsedMs < SCORING_MS) return 'scoring';
  return 'narrative';
}

export function isGeminiRateLimit(message: string): boolean {
  return /429|rate.?limit|RESOURCE_EXHAUSTED|Resource exhausted|quota|billing|prepayment/i.test(message);
}

export function isGeminiRateLimitError(err: unknown): boolean {
  if (err instanceof ApiError) return err.code === 'gemini_billing';
  if (err instanceof Error) return isGeminiRateLimit(err.message);
  if (typeof err === 'string') return isGeminiRateLimit(err);
  return false;
}

export function synthesizeStepError(greenlight: AgentRunResult | null): string | undefined {
  const step = greenlight?.steps?.find(s => s.step === 'SYNTHESIZE');
  const output = step?.output as { geminiError?: string } | undefined;
  return step?.error ?? output?.geminiError;
}

export function usedScorerFallback(greenlight: AgentRunResult | null): boolean {
  if (!greenlight) return false;
  if (greenlight.fallback === true) return true;
  const step = greenlight.steps?.find(s => s.step === 'SYNTHESIZE');
  if (!step) return false;
  const output = step.output as { fallback?: boolean } | undefined;
  return step.status === 'error' || output?.fallback === true;
}

export function greenlightGeminiStatus(
  greenlight: AgentRunResult | null
): 'explained' | 'skipped' | 'error' | undefined {
  if (!greenlight) return undefined;
  if (greenlight.geminiStatus) return greenlight.geminiStatus;
  if (!usedScorerFallback(greenlight)) return 'explained';
  return synthesizeStepError(greenlight) ? 'error' : 'skipped';
}

export function greenlightMcpMs(greenlight: AgentRunResult | null): number | undefined {
  if (!greenlight) return undefined;
  if (typeof greenlight.mcpMs === 'number') return greenlight.mcpMs;
  const discover = greenlight.steps?.find(s => s.step === 'DISCOVER');
  const queries = (discover?.output as { queries?: Array<{ latencyMs?: number }> } | undefined)?.queries;
  if (!queries?.length) return undefined;
  if (!queries.some(q => typeof q.latencyMs === 'number')) return undefined;
  return queries.reduce((sum, q) => sum + (q.latencyMs ?? 0), 0);
}

export function greenlightGeminiMs(greenlight: AgentRunResult | null): number | undefined {
  if (!greenlight) return undefined;
  if (typeof greenlight.geminiMs === 'number') return greenlight.geminiMs;
  const step = greenlight.steps?.find(s => s.step === 'SYNTHESIZE');
  return typeof step?.latencyMs === 'number' ? step.latencyMs : undefined;
}

interface TopCandidate {
  title: string;
  genre: string;
  opportunity_score?: number;
  wow_pct?: number;
  genre_gap?: number;
  in_cannibal_pair?: boolean;
}

export function topCandidatesFromSteps(greenlight: AgentRunResult | null): Recommendation[] {
  const planStep = greenlight?.steps?.find(s => s.step === 'PLAN_SQL');
  const output = planStep?.output as { topCandidates?: TopCandidate[] } | undefined;
  const candidates = output?.topCandidates ?? [];
  return candidates.map(c => ({
    title: c.title,
    genre: c.genre,
    justification: '',
    evidence: '',
    opportunity_score: c.opportunity_score,
    wow_pct: c.wow_pct,
    genre_gap: c.genre_gap,
    in_cannibal_pair: c.in_cannibal_pair
  }));
}

export function resolveGreenlightErrorMessage(
  raw: unknown,
  t: (key: string, vars?: Record<string, string | number>) => string
): { title?: string; message: string; isRateLimit: boolean } {
  const isRateLimit = isGeminiRateLimitError(raw);
  const message = formatApiError(t, raw, 'dashboard.greenlightError');

  if (isRateLimit) {
    return {
      title: t('dashboard.greenlightError429Title'),
      message: t('errors.geminiBilling'),
      isRateLimit: true
    };
  }
  return { message, isRateLimit: false };
}
