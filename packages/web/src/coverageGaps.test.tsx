import type { ReactElement } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider, LanguageToggle, readInitialLocale, STORAGE_KEY, useLocale } from './i18n/LocaleContext';
import { DataTable } from './components/DataTable';
import { StepOutput } from './components/StepOutput';
import { Card } from './components/Layout';
import { GreenlightPanel } from './components/GreenlightPanel';
import AnalyticsInsights from './components/AnalyticsInsights';
import { McpSqlEvidence } from './components/McpSqlEvidence';
import { GreenlightRitualPanel } from './components/GreenlightRitualPanel';
import { RecProvenance, SynthesizeFallbackBadge } from './components/GreenlightProvenance';
import { WeekSignalsPanel } from './components/WeekSignalsPanel';
import { AgentTimeline } from './components/AgentTimeline';
import { api } from './api';
import { buildWeekSignals } from './utils/weekSignals';
import { parseGreenlightAnalytics } from './utils/greenlightAnalytics';
import { weeklySlateToCsv } from './utils/greenlightExport';
import {
  isNearDuplicateTitle,
  isSeedFillerTitle,
  isPaddingTitle,
  extractCannibalPairs,
  metricsForRec,
  formatCast
} from './utils/greenlightMetrics';
import {
  usedScorerFallback,
  topCandidatesFromSteps,
  synthesizeStepError,
  resolveGreenlightErrorMessage
} from './utils/greenlightUx';
import { formatApiError, parseHttpError, timeoutError, ApiError } from './utils/apiErrors';
import type { AgentRunResult } from './api';

const t = (key: string, vars?: Record<string, string | number>) =>
  vars ? `${key}:${JSON.stringify(vars)}` : key;

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <LocaleProvider>{ui}</LocaleProvider>
    </MemoryRouter>
  );
}

const greenlight: AgentRunResult = {
  intent: 'greenlight',
  answer: 'memo',
  queryRows: [{ title: 'Pick', genre: 'Drama', opportunity_score: 0.2, wow_pct: 0.1, genre_gap: 0.1 }],
  recommendations: [
    {
      title: 'Pick',
      genre: 'Drama',
      justification: 'ok',
      evidence: 'e',
      opportunity_score: 0.2,
      wow_pct: 0.1,
      genre_gap: 0.1
    }
  ],
  steps: [
    {
      step: 'DISCOVER',
      status: 'completed',
      output: {
        queries: [
          { id: 'A_genre_inventory', sql: 'SELECT 1', rowCount: 1, latencyMs: 2, error: 'timeout' }
        ]
      }
    },
    { step: 'PLAN_SQL', status: 'completed', output: { topCandidates: [{ title: 'FromSteps', genre: 'Comedy' }] } },
    { step: 'SYNTHESIZE', status: 'error', error: 'writer', output: { fallback: true } }
  ],
  totalLatencyMs: 9,
  model: 'gemini-test'
};

describe('readInitialLocale', () => {
  it('reads storage, navigator language, and null storage', () => {
    expect(readInitialLocale({ getItem: () => 'es' })).toBe('es');
    expect(readInitialLocale({ getItem: () => 'en' })).toBe('en');
    expect(readInitialLocale({ getItem: () => 'fr' }, 'es-MX')).toBe('es');
    expect(readInitialLocale({ getItem: () => null }, 'en-US')).toBe('en');
    expect(readInitialLocale(null, 'es')).toBe('es');
    expect(readInitialLocale(undefined, '')).toBe('en');
  });
});

describe('LanguageToggle', () => {
  it('toggles locale and persists it', () => {
    wrap(<LanguageToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('es');
    fireEvent.click(screen.getByRole('button', { name: /idioma/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en');
  });

  it('throws when useLocale is used outside LocaleProvider', () => {
    function Bare() {
      useLocale();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/useLocale must be used within LocaleProvider/);
  });
});

describe('StepOutput remaining branches', () => {
  it('renders PLAN_SQL attempts, raw fallback, and collapsible queries', () => {
    wrap(
      <>
        <StepOutput step="PLAN_SQL" output={{ attempts: [{ note: 'retry', sql: 'SELECT 2' }] }} />
        <StepOutput
          step="PLAN_SQL"
          output={{ formula: 'opp', candidateCount: 3, momentumRowsScored: 9 }}
        />
        <StepOutput step="INTENT" output={{ intent: 'catalog_qa', source: 'gemini' }} />
        <StepOutput step="DISCOVER" output={{ extra: true }} />
        <StepOutput step="DISCOVER" output={{ schema: 'media_catalog.t(id UUID)' }} />
        <StepOutput
          step="DISCOVER"
          output={{
            queries: [
              { id: 'A', sql: 'SELECT 1', rowCount: 1, latencyMs: 2, rows: [null, { a: 1 }] },
              { sql: 'SELECT 3' }
            ]
          }}
        />
        <StepOutput
          step="EXECUTE"
          output={{ attempts: [{ error: '0 rows', sql: 'SELECT 1', rowCount: 0, retry: true }], rows: [{ g: 'Drama' }] }}
        />
        <StepOutput
          step="SYNTHESIZE"
          output={{ answer: 'memo', fallback: true, geminiError: 'timeout', recommendations: [{ title: 'T' }] }}
        />
        <StepOutput step="AUDIT" output={{ auditId: 'r1' }} />
        <Card id="named">named card</Card>
      </>
    );
    expect(screen.getAllByText('retry').length).toBeGreaterThan(0);
    expect(screen.getAllByText('r1').length).toBeGreaterThan(0);
    screen.getAllByRole('button').forEach(btn => fireEvent.click(btn));
  });
});

describe('DataTable empty object rows', () => {
  it('returns null when the first row has no keys', () => {
    const { container } = wrap(<DataTable rows={[{}]} />);
    expect(container.querySelector('table')).toBeNull();
  });

  it('treats a missing first row as empty columns', () => {
    const { container } = wrap(<DataTable rows={[undefined as unknown as Record<string, unknown>]} />);
    expect(container.querySelector('table')).toBeNull();
  });

  it('formats integer cells and no booleans', () => {
    wrap(<DataTable rows={[{ n: 2, ok: false }]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('AnalyticsInsights empty lists and negative wow', () => {
  it('renders empty-state copy and a down bar', () => {
    wrap(
      <AnalyticsInsights
        analytics={{
          genreGaps: [],
          momentumHighlights: [{ title: 'Down', genre: 'Drama', wowPct: -0.2 }],
          cannibalPairs: []
        }}
      />
    );
    expect(screen.getByText(/No rows for this query|Sin filas/i)).toBeInTheDocument();
  });

  it('renders empty momentum copy when only genre gaps exist', () => {
    wrap(
      <AnalyticsInsights
        analytics={{
          genreGaps: [{ genre: 'Thriller', gapScore: 0.4, titleShare: 0.1, revenueShare: 0.3, titleCount: 2 }],
          momentumHighlights: [],
          cannibalPairs: [
            { titleA: 'A', titleB: 'B', genre: 'Drama', revenueA: 10, revenueB: 20 }
          ]
        }}
      />
    );
    expect(screen.getByText(/meaningful week-over-week|movimiento semana/i)).toBeInTheDocument();
  });
});

describe('McpSqlEvidence', () => {
  it('returns null without SQL queries and toggles error details', () => {
    const empty = wrap(<McpSqlEvidence greenlight={{ ...greenlight, steps: [] }} />);
    expect(empty.container.querySelector('.mcp-sql-evidence')).toBeNull();
    empty.unmount();

    const notArray = wrap(
      <McpSqlEvidence
        greenlight={{
          ...greenlight,
          steps: [{ step: 'DISCOVER', status: 'completed', output: { queries: { id: 'x' } } }]
        }}
      />
    );
    expect(notArray.container.querySelector('.mcp-sql-evidence')).toBeNull();
    notArray.unmount();

    wrap(<McpSqlEvidence greenlight={greenlight} />);
    fireEvent.click(screen.getByRole('button', { name: /A_genre_inventory/i }));
    expect(screen.getByText('timeout')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /A_genre_inventory/i }));
  });

  it('renders SQL meta defaults when row counts are missing', () => {
    wrap(
      <McpSqlEvidence
        greenlight={{
          ...greenlight,
          steps: [
            {
              step: 'DISCOVER',
              status: 'completed',
              output: { queries: [{ id: 'B_title_momentum', sql: 'SELECT wow' }] }
            }
          ]
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /B_title_momentum/i }));
    expect(screen.getByText('SELECT wow')).toBeInTheDocument();
  });
});

describe('GreenlightRitualPanel extra pairs', () => {
  it('shows contrafactual overflow and returns null without recs', () => {
    expect(wrap(<GreenlightRitualPanel greenlight={{ ...greenlight, recommendations: [] }} />).container.textContent).toBe(
      ''
    );
    expect(
      wrap(
        <GreenlightRitualPanel greenlight={{ intent: 'greenlight', answer: '', steps: [], totalLatencyMs: 1, model: 'x' }} />
      ).container.textContent
    ).toBe('');
    wrap(
      <GreenlightRitualPanel
        greenlight={{
          ...greenlight,
          queryRows: undefined,
          recommendations: [{ title: 'Pick', genre: 'Drama', justification: 'ok', evidence: 'e', in_cannibal_pair: true }],
          steps: [
            {
              step: 'DISCOVER',
              status: 'completed',
              output: {
                fullById: {
                  C_cannibalization: [
                    { title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' },
                    { title_a: 'Shadow Road 86', title_b: 'Shadow Road 86 Recut', genre: 'Thriller' },
                    { title_a: 'Winter Harbor', title_b: 'Winter Harbor Cut', genre: 'Drama' }
                  ]
                }
              }
            }
          ]
        }}
      />
    );
    expect(screen.getByText(/more near-duplicate|pares casi duplicados/i)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});

describe('provenance and timeline', () => {
  it('renders rec provenance without wow_momentum and a failed step', () => {
    wrap(
      <>
        <RecProvenance rec={{ title: 'X', genre: 'Drama', justification: '', evidence: '' }} queryRows={[]} />
        <RecProvenance
          rec={{ title: 'Z', genre: 'Drama', justification: '', evidence: '', in_cannibal_pair: true }}
          queryRows={[]}
        />
        <RecProvenance
          rec={{ title: 'Y', genre: 'Drama', justification: '', evidence: '', in_cannibal_pair: true }}
          queryRows={[{ title: 'Y', wow_momentum: 0.4, wow_pct: 0.2, cannibalization_penalty: 1 }]}
        />
        <SynthesizeFallbackBadge greenlight={{ ...greenlight, steps: [] }} />
        <AgentTimeline
          steps={[
            { step: 'INTENT', status: 'pending' },
            { step: 'EXECUTE', status: 'failed', error: 'nope', output: { rows: [] } }
          ]}
        />
      </>
    );
    expect(screen.getByText('nope')).toBeInTheDocument();
  });
});

describe('GreenlightPanel remaining UI', () => {
  it('uses step candidates and pending narrative', () => {
    wrap(
      <GreenlightPanel
        greenlight={{
          ...greenlight,
          recommendations: [],
          queryRows: [],
          answer: '',
          steps: [
            {
              step: 'PLAN_SQL',
              status: 'completed',
              output: { topCandidates: [{ title: 'FromSteps', genre: 'Comedy', opportunity_score: 0.1 }] }
            }
          ]
        }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText('FromSteps')).toBeInTheDocument();
    expect(screen.getByText(/Narrative pending|Narrativa pendiente/i)).toBeInTheDocument();
  });

  it('shows a generic error without a title', () => {
    wrap(<GreenlightPanel greenlight={null} loading={false} error={new Error('plain fail')} />);
    expect(screen.getByText('plain fail')).toBeInTheDocument();
  });

  it('pulls numeric metrics from matching query rows', () => {
    wrap(
      <GreenlightPanel
        greenlight={{
          ...greenlight,
          recommendations: [
            { title: 'Bare', genre: '', justification: '', evidence: '' },
            { title: 'Pick', genre: 'Drama', justification: 'ok', evidence: 'e' }
          ],
          queryRows: [
            {
              title: 'Pick',
              opportunity_score: '0.5',
              wow_pct: '0.2',
              genre_gap: '0.1',
              in_cannibal_pair: 'yes'
            },
            {
              title: 'Bare',
              opportunity_score: 0.5,
              wow_pct: 0.2,
              genre_gap: 0.1,
              in_cannibal_pair: true
            }
          ]
        }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getAllByText('0.500').length).toBeGreaterThan(0);
  });
});

describe('weekSignals remaining branches', () => {
  it('covers loading, stats-only, cannibal single, and breakout pick', () => {
    const loading = buildWeekSignals(null, null, true, true, t);
    expect(loading.partial).toBe(true);
    expect(loading.bullets.join(' ')).toMatch(/loading/);

    const statsOnly = buildWeekSignals(
      { totalEntries: 10, genres: { Comedy: 8, Thriller: 2 }, recentAdditions: 1 },
      null,
      false,
      false,
      t
    );
    expect(statsOnly.bullets[0]).toMatch(/comedyStatsOnly|Comedy/);

    const noThrillerStats = buildWeekSignals(
      { totalEntries: 1, genres: {}, recentAdditions: 0 },
      null,
      false,
      false,
      t
    );
    expect(noThrillerStats.bullets[1]).toMatch(/loading.thriller|thriller/);

    const cannibalSingle = buildWeekSignals(null, {
      intent: 'greenlight',
      answer: '',
      recommendations: [{ title: 'Solo', genre: 'Drama', justification: '', evidence: '', in_cannibal_pair: true }],
      steps: [],
      totalLatencyMs: 1,
      model: 'x'
    }, false, false, t);
    expect(cannibalSingle.bullets[2]).toMatch(/cannibalSingle|Solo/);

    const breakoutPick = buildWeekSignals(null, {
      intent: 'greenlight',
      answer: '',
      recommendations: [{ title: 'Pick', genre: 'Drama', justification: '', evidence: '', wow_pct: 0.2, opportunity_score: 0.3 }],
      steps: [],
      queryRows: [{ title: 'Row' }],
      totalLatencyMs: 1,
      model: 'x'
    }, false, false, t);
    expect(breakoutPick.bullets[3]).toMatch(/breakoutPick|Pick/);

    const fromQueryRows = buildWeekSignals(null, {
      intent: 'greenlight',
      answer: '',
      recommendations: [],
      steps: [],
      queryRows: [{ title: 'Q', genre: 'Drama', opportunity_score: '0.2', wow_pct: '0.1', genre_gap: 'x', in_cannibal_pair: true }],
      totalLatencyMs: 1,
      model: 'x'
    }, false, false, t);
    expect(fromQueryRows.bullets[3]).toMatch(/Q/);

    const comedyFromInventory = buildWeekSignals(
      null,
      {
        intent: 'greenlight',
        answer: '',
        recommendations: [],
        steps: [
          {
            step: 'DISCOVER',
            status: 'completed',
            output: {
              queries: [
                { id: 'A_genre_inventory', rows: [{ genre: 'Comedy' }, { genre: 'Thriller' }, { genre: 'Drama', title_count: true }] },
                { id: 'D_slate_holes', rows: [{ hole_type: 'genre', dimension: 'Drama', gap_score: 'not-a-number' }] },
                { id: 'B_title_momentum', rows: [
                  { title: 'Latam', language: 'es' },
                  { title: 'Mid', language: 'es', wow_pct: 0.2, genre: 'Thriller' },
                  { title: 'Best', language: 'es', wow_pct: 0.4, genre: 'Thriller' },
                  { title: 'Low', language: 'es', wow_pct: 0.05, genre: 'Thriller' }
                ] }
              ]
            }
          }
        ],
        totalLatencyMs: 1,
        model: 'x'
      },
      false,
      false,
      t
    );
    expect(comedyFromInventory.bullets[0]).toMatch(/comedy/);
    expect(comedyFromInventory.bullets[1]).toMatch(/thrillerInventory|Thriller/);
    expect(comedyFromInventory.bullets[3]).toMatch(/Best/);
    const noLatamMomentum = buildWeekSignals(null, {
      intent: 'greenlight',
      answer: '',
      recommendations: [{ title: 'NoScore', genre: 'Drama', justification: '', evidence: '' }],
      steps: [
        {
          step: 'DISCOVER',
          status: 'completed',
          output: {
            queries: [
              { id: 'B_title_momentum', rows: [{ title: 'Down', language: null, wow_pct: -0.2, genre: 'Drama' }] }
            ]
          }
        }
      ],
      totalLatencyMs: 1,
      model: 'x'
    }, false, false, t);
    const dashScore = buildWeekSignals(null, {
      intent: 'greenlight',
      answer: '',
      recommendations: [{ title: 'Dash', genre: 'Drama', justification: '', evidence: '' }],
      steps: [],
      totalLatencyMs: 1,
      model: 'x'
    }, false, false, t);
    const fromSteps = buildWeekSignals(null, {
      intent: 'greenlight',
      answer: '',
      steps: [
        { step: 'PLAN_SQL', status: 'completed', output: { topCandidates: [{ title: 'FromSteps', genre: 'Comedy' }] } }
      ],
      totalLatencyMs: 1,
      model: 'x'
    }, false, false, t);
    expect(fromSteps.bullets[2]).toMatch(/FromSteps|cannibal|loading/i);
    expect(fromSteps.bullets[3]).toMatch(/FromSteps/);
    expect(noLatamMomentum.bullets[3]).toMatch(/Down/);
    expect(dashScore.bullets[3]).toMatch(/Dash/);
  });
});

describe('analytics export metrics extras', () => {
  it('returns null for empty parsed analytics and escapes csv quotes', () => {
    expect(parseGreenlightAnalytics({ intent: 'greenlight', answer: '', steps: [], totalLatencyMs: 1, model: 'x' })).toBeNull();
    expect(
      parseGreenlightAnalytics({
        intent: 'greenlight',
        answer: '',
        steps: [{ step: 'DISCOVER', status: 'completed', output: { fullById: { A_genre_inventory: 'nope' } } }],
        totalLatencyMs: 1,
        model: 'x'
      })
    ).toBeNull();

    const csv = weeklySlateToCsv({
      intent: 'greenlight',
      answer: '',
      recommendations: [{ title: 'He said "hi"', genre: 'Drama, X', justification: 'line\nbreak', evidence: 'e' }],
      steps: [],
      totalLatencyMs: 1,
      model: 'x'
    });
    expect(csv).toContain('""hi""');
    expect(
      weeklySlateToCsv({
        intent: 'greenlight',
        answer: '',
        steps: [],
        totalLatencyMs: 1,
        model: 'x'
      })
    ).toMatch(/rank,title/);
    expect(
      weeklySlateToCsv({
        intent: 'greenlight',
        answer: '',
        recommendations: [{ title: 'Solo', genre: 'Drama', justification: 'j', evidence: 'e', in_cannibal_pair: true }],
        steps: [],
        totalLatencyMs: 1,
        model: 'x'
      })
    ).toMatch(/true/);

    expect(parseGreenlightAnalytics({
      intent: 'greenlight',
      answer: '',
      steps: [{
        step: 'DISCOVER',
        status: 'completed',
        output: {
          fullById: {
            D_slate_holes: [
              { hole_type: 'genre', dimension: null, gap_score: 'nope', title_share: '0.1', revenue_share: 0.3, title_count: 4 }
            ],
            B_title_momentum: [{ title: true, genre: 'Drama', wow_pct: true }],
            C_cannibalization: [
              { title_a: 'The Great Show Part', title_b: 'The Great Show Extra', genre: 'Drama', revenue_a: '1', revenue_b: 2 }
            ]
          }
        }
      }],
      totalLatencyMs: 1,
      model: 'x'
    })?.genreGaps[0].titleCount).toBe(4);

    expect(extractCannibalPairs([
      {
        step: 'DISCOVER',
        status: 'completed',
        output: {
          queries: [
            { id: 'C_cannibalization', rows: [{ title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' }] }
          ]
        }
      }
    ])).toHaveLength(1);
    expect(extractCannibalPairs([
      {
        step: 'DISCOVER',
        status: 'completed',
        output: {
          fullById: {
            C_cannibalization: [
              { title_b: 'Only B' },
              { title_a: 'Only A' },
              { title_a: 'Alpha', title_b: 'Zeta' }
            ]
          }
        }
      }
    ])).toEqual([]);

    expect(isNearDuplicateTitle('The Great Show Part', 'The Great Show Extra')).toBe(true);
    expect(readInitialLocale()).toBe('en');
    expect(formatApiError(t, new ApiError('timeout', 'x'))).toContain('errors.timeout');
    expect(parseHttpError(418, '   ').message).toMatch(/HTTP 418/);
    expect(metricsForRec({ title: 'Y', genre: 'Drama', justification: '', evidence: '' }, [
      { title: 'Y', opportunity_score: 1, wow_pct: 0.2, genre_gap: 0.1, wow_momentum: 0.4, in_cannibal_pair: true }
    ]).wow_momentum).toBe(0.4);

    expect(isNearDuplicateTitle('', 'a')).toBe(false);
    expect(isNearDuplicateTitle('abcdefghijklmnopXXX', 'abcdefghijklmnopYYY')).toBe(true);
    expect(isSeedFillerTitle('')).toBe(true);
    expect(isSeedFillerTitle('Real Title', 'padding title')).toBe(true);
    expect(isPaddingTitle('Catalog Extra 1')).toBe(true);
    expect(formatCast([])).toBe('—');
    expect(extractCannibalPairs([])).toEqual([]);
    expect(extractCannibalPairs([{ step: 'DISCOVER', status: 'completed', output: 'x' }])).toEqual([]);
    expect(
      metricsForRec({ title: 'Missing', genre: 'Drama', justification: '', evidence: '' }, [{ title: 'Other', opportunity_score: 1 }])
        .opportunity_score
    ).toBeUndefined();
    expect(usedScorerFallback(null)).toBe(false);
    expect(topCandidatesFromSteps(null)).toEqual([]);
    expect(synthesizeStepError(null)).toBeUndefined();
    expect(resolveGreenlightErrorMessage(12, t).isRateLimit).toBe(false);
    expect(parseHttpError(503, '{"code":"clickhouse_waking","message":"boot"}').code).toBe('clickhouse_waking');
    expect(parseHttpError(500, '{"error":"  " }').message).toMatch(/HTTP 500|  /);
    expect(timeoutError().code).toBe('timeout');
    expect(formatApiError(t, 12)).toBe('errors.generic');
  });
});

describe('WeekSignalsPanel', () => {
  it('marks partial measuring state', () => {
    wrap(
      <WeekSignalsPanel stats={null} greenlight={null} statsLoading greenlightLoading />
    );
    expect(screen.getByText(/Updating from ClickHouse|Actualizando desde ClickHouse/i)).toBeInTheDocument();
  });
});

describe('api client remaining catch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rethrows generic fetch failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('socket down');
    }));
    await expect(api.health()).rejects.toThrow('socket down');
  });
});
