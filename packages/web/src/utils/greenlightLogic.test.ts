import { describe, expect, it, vi } from 'vitest';
import {
  formatPct,
  isSeedFillerTitle,
  formatCast,
  scorerFormulaText,
  metricsForRec,
  extractCannibalPairs,
  isNearDuplicateTitle
} from './greenlightMetrics';
import { parseHttpError, timeoutError, formatApiError, ApiError } from './apiErrors';
import {
  greenlightPhaseFromElapsed,
  usedScorerFallback,
  topCandidatesFromSteps,
  isGeminiRateLimitError,
  resolveGreenlightErrorMessage,
  greenlightGeminiStatus,
  greenlightMcpMs,
  greenlightGeminiMs,
  synthesizeStepError,
  greenlightFallbackKind,
  greenlightFallbackNoticeKey
} from './greenlightUx';
import { parseGreenlightAnalytics } from './greenlightAnalytics';
import { weeklySlateToCsv, contrafactualPairs, buildWeeklySlateExport, exportWeeklySlate, weeklySlateToJson, programmingMemo, gapFilledFromRun } from './greenlightExport';
import { buildWeekSignals } from './weekSignals';
import type { AgentRunResult } from '../api';

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key;

const sampleRun = (): AgentRunResult => ({
  intent: 'greenlight',
  answer: 'memo',
  queryRows: [
    {
      title: 'Crimen sin Fronteras: Bogotá',
      opportunity_score: 0.26,
      wow_pct: 0.32,
      genre_gap: 0.13,
      wow_momentum: 0.4,
      in_cannibal_pair: false
    }
  ],
  recommendations: [
    {
      title: 'Crimen sin Fronteras: Bogotá',
      genre: 'Thriller',
      justification: 'breakout',
      evidence: 'wow 32%',
      opportunity_score: 0.26,
      wow_pct: 0.32,
      genre_gap: 0.13,
      in_cannibal_pair: false
    }
  ],
  steps: [
    {
      step: 'DISCOVER',
      status: 'completed',
      output: {
        fullById: {
          A_genre_inventory: [{ genre: 'Comedy', title_count: 52, revenue_4w: 100 }, { genre: 'Thriller', title_count: 15, revenue_4w: 200 }],
          B_title_momentum: [
            { title: 'Crimen sin Fronteras: Bogotá', genre: 'Thriller', language: 'es', wow_pct: 0.32 }
          ],
          C_cannibalization: [
            { title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' }
          ],
          D_slate_holes: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.42, title_share: 0.1, revenue_share: 0.3 }]
        },
        queries: [
          { id: 'A_genre_inventory', rows: [{ genre: 'Comedy', title_count: 52, revenue_4w: 100 }] },
          { id: 'C_cannibalization', rows: [{ title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' }] },
          { id: 'D_slate_holes', rows: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.42 }] },
          { id: 'B_title_momentum', rows: [{ title: 'Crimen sin Fronteras: Bogotá', language: 'es', wow_pct: 0.32, genre: 'Thriller' }] }
        ]
      }
    },
    {
      step: 'PLAN_SQL',
      status: 'completed',
      output: {
        topCandidates: [{ title: 'Crimen sin Fronteras: Bogotá', genre: 'Thriller', opportunity_score: 0.26 }]
      }
    },
    { step: 'SYNTHESIZE', status: 'completed', output: { fallback: true } }
  ],
  totalLatencyMs: 12,
  model: 'gemini-test'
});

describe('greenlightMetrics', () => {
  it('formats percents and detects seed filler', () => {
    expect(formatPct(0.321)).toBe('32.1%');
    expect(formatPct(undefined)).toBe('—');
    expect(isSeedFillerTitle('Fading Line 75')).toBe(true);
    expect(isSeedFillerTitle('Crimen sin Fronteras: Bogotá')).toBe(false);
    expect(formatCast(['Actor A', 'Actor B'])).toBe('—');
    expect(formatCast(['Gael García Bernal'])).toContain('Gael');
    expect(scorerFormulaText()).toContain('language_gap');
    expect(isNearDuplicateTitle('True Crime: Highway 101', 'True Crime: Highway 101 Redux')).toBe(true);
  });

  it('merges rec metrics from query rows', () => {
    const rec = sampleRun().recommendations![0];
    const metrics = metricsForRec(rec, sampleRun().queryRows as Record<string, unknown>[]);
    expect(metrics.opportunity_score).toBe(0.26);
    const pairs = extractCannibalPairs(sampleRun().steps);
    expect(pairs).toHaveLength(1);
    expect(
      extractCannibalPairs([
        {
          step: 'DISCOVER',
          status: 'completed',
          output: {
            queries: [
              {
                id: 'C_cannibalization',
                rows: [
                  {
                    title_a: 'True Crime: Highway 101',
                    title_b: 'True Crime: Highway 101 Redux',
                    genre: 'Documentary'
                  }
                ]
              }
            ]
          }
        }
      ])
    ).toEqual([
      {
        title_a: 'True Crime: Highway 101',
        title_b: 'True Crime: Highway 101 Redux',
        genre: 'Documentary'
      }
    ]);
    expect(
      extractCannibalPairs([
        { step: 'DISCOVER', status: 'completed', output: {} }
      ])
    ).toEqual([]);
    expect(
      extractCannibalPairs([
        {
          step: 'DISCOVER',
          status: 'completed',
          output: { queries: [{ id: 'C_cannibalization' }] }
        }
      ])
    ).toEqual([]);
  });
});

describe('apiErrors', () => {
  it('parses billing, waking, and generic HTTP bodies', () => {
    expect(parseHttpError(429, '{"code":"gemini_billing","error":"quota"}').code).toBe('gemini_billing');
    expect(parseHttpError(503, 'still initializing').code).toBe('clickhouse_waking');
    expect(parseHttpError(500, 'nope').code).toBe('generic');
    expect(timeoutError(1000).code).toBe('timeout');
    expect(formatApiError(t, new ApiError('gemini_billing', 'x'))).toBe('errors.geminiBilling');
    expect(formatApiError(t, new TypeError('Failed to fetch'))).toBe('errors.network');
    expect(formatApiError(t, new ApiError('timeout', 'x', undefined, undefined, 5_000))).toContain('5');
    expect(formatApiError(t, new Error('request timed out'))).toContain('errors.timeout');
    expect(formatApiError(t, new Error('quota exceeded'))).toBe('errors.geminiBilling');
    expect(formatApiError(t, new Error('still initializing'))).toBe('errors.clickhouseWaking');
    expect(formatApiError(t, new Error('plain'))).toBe('plain');
    expect(formatApiError(t, 'nope', 'fallback.key')).toBe('fallback.key');
  });
});

describe('greenlightUx', () => {
  it('maps phases and fallback', () => {
    expect(greenlightPhaseFromElapsed(1000)).toBe('measuring');
    expect(greenlightPhaseFromElapsed(30_000)).toBe('scoring');
    expect(greenlightPhaseFromElapsed(50_000)).toBe('narrative');
    expect(usedScorerFallback(sampleRun())).toBe(true);
    expect(usedScorerFallback(null)).toBe(false);
    expect(usedScorerFallback({ ...sampleRun(), fallback: false, steps: [] })).toBe(false);
    expect(topCandidatesFromSteps(sampleRun())[0].title).toContain('Crimen');
    expect(isGeminiRateLimitError(new ApiError('gemini_billing', 'x'))).toBe(true);
    expect(isGeminiRateLimitError(new Error('429 quota'))).toBe(true);
    expect(isGeminiRateLimitError('RESOURCE_EXHAUSTED')).toBe(true);
    expect(isGeminiRateLimitError(12)).toBe(false);
    const resolved = resolveGreenlightErrorMessage(new ApiError('gemini_billing', 'x'), t);
    expect(resolved.isRateLimit).toBe(true);
    expect(greenlightGeminiStatus(null)).toBeUndefined();
    expect(greenlightGeminiStatus(sampleRun())).toBe('skipped');
    expect(greenlightGeminiStatus({ ...sampleRun(), geminiStatus: 'explained' })).toBe('explained');
    expect(
      greenlightGeminiStatus({
        ...sampleRun(),
        fallback: false,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { fallback: false } }]
      })
    ).toBe('explained');
    expect(
      greenlightGeminiStatus({
        ...sampleRun(),
        fallback: true,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { geminiError: 'quota' } }]
      })
    ).toBe('error');
    expect(synthesizeStepError(null)).toBeUndefined();
    expect(greenlightMcpMs(null)).toBeUndefined();
    expect(greenlightMcpMs({ ...sampleRun(), mcpMs: 9 })).toBe(9);
    expect(greenlightMcpMs({ ...sampleRun(), mcpMs: undefined, steps: [] })).toBeUndefined();
    expect(
      greenlightMcpMs({
        ...sampleRun(),
        mcpMs: undefined,
        steps: [{ step: 'DISCOVER', status: 'completed', output: { queries: [] } }]
      })
    ).toBeUndefined();
    expect(
      greenlightMcpMs({
        ...sampleRun(),
        mcpMs: undefined,
        steps: [
          {
            step: 'DISCOVER',
            status: 'completed',
            output: { queries: [{ id: 'A' }, { id: 'B' }] }
          }
        ]
      })
    ).toBeUndefined();
    expect(
      greenlightMcpMs({
        ...sampleRun(),
        mcpMs: undefined,
        steps: [
          {
            step: 'DISCOVER',
            status: 'completed',
            output: { queries: [{ id: 'A' }, { id: 'B', latencyMs: 4 }] }
          }
        ]
      })
    ).toBe(4);
    expect(
      greenlightMcpMs({
        ...sampleRun(),
        mcpMs: undefined,
        steps: [
          {
            step: 'DISCOVER',
            status: 'completed',
            output: { queries: [{ id: 'A', latencyMs: 2 }, { id: 'B', latencyMs: 3 }] }
          }
        ]
      })
    ).toBe(5);
    expect(greenlightGeminiMs(null)).toBeUndefined();
    expect(greenlightGeminiMs({ ...sampleRun(), geminiMs: 11 })).toBe(11);
    expect(greenlightGeminiMs({ ...sampleRun(), geminiMs: undefined, steps: [] })).toBeUndefined();
    expect(
      greenlightGeminiMs({
        ...sampleRun(),
        geminiMs: undefined,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', latencyMs: 22 }]
      })
    ).toBe(22);
    expect(greenlightFallbackKind(null)).toBeNull();
    expect(greenlightFallbackKind({ ...sampleRun(), fallback: false, steps: [] })).toBeNull();
    expect(
      greenlightFallbackKind({
        ...sampleRun(),
        fallback: true,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { geminiError: 'Your prepayment credits are depleted' } }]
      })
    ).toBe('quota');
    expect(
      greenlightFallbackKind({
        ...sampleRun(),
        fallback: true,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { geminiError: '429 Resource exhausted' } }]
      })
    ).toBe('generic');
    expect(
      greenlightFallbackKind({
        ...sampleRun(),
        fallback: true,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { geminiError: 'Please go to AI Studio at https://ai.studio' } }]
      })
    ).toBe('generic');
    expect(
      greenlightFallbackKind({
        ...sampleRun(),
        fallback: true,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { geminiError: 'Gemini synthesis timed out after 25s' } }]
      })
    ).toBe('timeout');
    expect(
      greenlightFallbackKind({
        ...sampleRun(),
        fallback: true,
        steps: [{ step: 'SYNTHESIZE', status: 'completed', output: { geminiError: '429 Resource exhausted' } }]
      })
    ).toBe('generic');
    expect(greenlightFallbackKind(sampleRun())).toBe('generic');
    expect(greenlightFallbackNoticeKey('quota')).toBe('dashboard.greenlightFallbackQuota');
    expect(greenlightFallbackNoticeKey('timeout')).toBe('dashboard.greenlightFallbackTimeout');
    expect(greenlightFallbackNoticeKey('generic')).toBe('dashboard.greenlightFallbackNotice');
  });
});

describe('analytics export signals', () => {
  it('parses analytics and csv', () => {
    const analytics = parseGreenlightAnalytics(sampleRun());
    expect(analytics?.genreGaps[0].genre).toBe('Thriller');
    expect(weeklySlateToCsv(sampleRun())).toContain('Crimen sin Fronteras: Bogotá');
    expect(contrafactualPairs(
      [{ title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' }],
      sampleRun().recommendations!
    )).toHaveLength(1);
    expect(buildWeeklySlateExport(sampleRun()).slate).toHaveLength(1);
    const signals = buildWeekSignals(
      { totalEntries: 200, genres: { Comedy: 52, Thriller: 15 }, recentAdditions: 1 },
      sampleRun(),
      false,
      false,
      t
    );
    expect(signals.bullets).toHaveLength(4);
    expect(parseGreenlightAnalytics(null)).toBeNull();
  });

  it('downloads csv and json slate files', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    exportWeeklySlate(sampleRun(), 'csv');
    exportWeeklySlate(sampleRun(), 'json');
    expect(weeklySlateToJson(sampleRun())).toContain('Crimen');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('builds a deterministic memo when Gemini fallback is set', () => {
    const memo = programmingMemo({ ...sampleRun(), fallback: true });
    expect(memo.source).toBe('template');
    expect(memo.text).toMatch(/TypeScript scorer/);
    expect(
      programmingMemo({
        ...sampleRun(),
        fallback: true,
        cannibalExcluded: [
          {
            title: 'True Crime: Highway 101',
            genre: 'Documentary',
            opportunity_score: 0.02,
            pair: { title_a: 'True Crime: Highway 101', title_b: 'Redux', genre: 'Documentary' },
            copy: 'split'
          }
        ]
      }).text
    ).toMatch(/Cannibal exclusions/);
    expect(gapFilledFromRun(sampleRun()).available).toBe(true);
    expect(gapFilledFromRun(sampleRun()).label).not.toMatch(/0\.074/);
    expect(programmingMemo({ ...sampleRun(), answer: undefined, fallback: false }).source).toBe('template');
    expect(programmingMemo({ ...sampleRun(), answer: '   ', fallback: false }).source).toBe('template');
    expect(
      programmingMemo({
        ...sampleRun(),
        fallback: false,
        answer: 'Weekly greenlight from measured ClickHouse analytics. TypeScript scored the slate; Gemini memo is optional.'
      }).source
    ).toBe('template');
    expect(programmingMemo({ ...sampleRun(), answer: 'Chief memo from Gemini.', fallback: false }).source).toBe(
      'gemini'
    );
    expect(gapFilledFromRun({ ...sampleRun(), steps: [] }).available).toBe(false);
    expect(
      gapFilledFromRun({
        ...sampleRun(),
        steps: [
          {
            step: 'DISCOVER',
            status: 'completed',
            output: {
              queries: [
                {
                  id: 'D_slate_holes',
                  rows: [
                    { hole_type: 'language', dimension: 'es', gap_score: 0.9 },
                    { dimension: 'Thriller', gap_score: 0.4 },
                    { hole_type: 'genre', gap_score: 0.01 },
                    { hole_type: 'genre', genre: 'Comedy', gap_score: '0.21' }
                  ]
                }
              ]
            }
          }
        ]
      }).label
    ).toMatch(/Thriller gap_score 0\.400/);
  });
});
