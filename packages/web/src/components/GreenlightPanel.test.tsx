import type { ReactElement } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../i18n/LocaleContext';
import { GreenlightPanel } from './GreenlightPanel';
import { SlateReviewFlow } from './SlateReviewFlow';
import { translate, translations } from '../i18n/translations';
import { ApiError } from '../utils/apiErrors';
import type { AgentRunResult } from '../api';

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <LocaleProvider>{ui}</LocaleProvider>
    </MemoryRouter>
  );
}

const run: AgentRunResult = {
  intent: 'greenlight',
  answer: 'Weekly memo',
  queryRows: [
    { title: 'Crimen sin Fronteras: Bogotá', opportunity_score: 0.268, wow_pct: 0.32, genre_gap: 0.135, in_cannibal_pair: false }
  ],
  recommendations: [
    {
      title: 'Crimen sin Fronteras: Bogotá',
      genre: 'Thriller',
      justification: 'LATAM breakout',
      evidence: 'wow 32%',
      opportunity_score: 0.268,
      wow_pct: 0.32,
      genre_gap: 0.135,
      in_cannibal_pair: false
    }
  ],
  steps: [
    { step: 'SYNTHESIZE', status: 'completed', output: { fallback: true, answer: 'Weekly memo' } },
    {
      step: 'DISCOVER',
      status: 'completed',
      output: {
        fullById: {
          A_genre_inventory: [{ genre: 'Thriller', title_count: 15, revenue_4w: 200 }],
          B_title_momentum: [{ title: 'Crimen sin Fronteras: Bogotá', genre: 'Thriller', wow_pct: 0.32 }],
          C_cannibalization: [
            { title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' }
          ],
          D_slate_holes: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.42, title_share: 0.1, revenue_share: 0.3 }]
        },
        queries: [
          { id: 'A_genre_inventory', sql: 'SELECT genre', rowCount: 1, latencyMs: 4 }
        ]
      }
    }
  ],
  totalLatencyMs: 40,
  model: 'gemini-test',
  fallback: true,
  geminiStatus: 'error',
  mcpMs: 4,
  geminiMs: 12,
  cannibalExcluded: [
    {
      title: 'True Crime: Highway 101',
      genre: 'Documentary',
      opportunity_score: 0.025,
      pair: { title_a: 'True Crime: Highway 101', title_b: 'True Crime: Highway 101 Redux', genre: 'Documentary' },
      copy: 'If you greenlit both, they split the same audience.'
    }
  ]
};

describe('i18n', () => {
  it('shares the same key tree in EN and ES and interpolates', () => {
    expect(Object.keys(translations.en)).toEqual(Object.keys(translations.es));
    expect(translate('en', 'errors.timeout', { seconds: 10 })).toContain('10');
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });
});

describe('GreenlightPanel', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('shows scored cards, fallback notice, SQL evidence, and export', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    wrap(<GreenlightPanel greenlight={run} loading={false} error={null} />);
    expect(screen.getAllByText('Crimen sin Fronteras: Bogotá').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.268').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gemini did not invent the ranking/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/MCP: A_genre_inventory/i)).toBeInTheDocument();
    fireEvent.click(document.querySelector('.rec-provenance-details summary') as HTMLElement);
    expect(screen.getAllByText(/A_genre_inventory/).length).toBeGreaterThan(0);
    expect(screen.getByText(/If you greenlit both, they split the same audience/i)).toBeInTheDocument();
    const sqlToggle = screen.queryByRole('button', { name: /A_genre_inventory/i });
    if (sqlToggle) fireEvent.click(sqlToggle);
    screen.getAllByRole('button').forEach(btn => {
      if (/review slate/i.test(btn.textContent ?? '')) fireEvent.click(btn);
    });
    screen.getAllByRole('button').forEach(btn => {
      if (/csv|json/i.test(btn.textContent ?? '')) fireEvent.click(btn);
    });
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('shows skeletons while loading', () => {
    wrap(<GreenlightPanel greenlight={null} loading={true} error={null} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('keeps cached slate dimmed while refreshing and retries on error', () => {
    const onRetry = vi.fn();
    wrap(<GreenlightPanel greenlight={run} loading={true} error={null} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(document.querySelector('.is-cached-dimmed')).not.toBeNull();
    expect(screen.getAllByText('Crimen sin Fronteras: Bogotá').length).toBeGreaterThan(0);

    wrap(
      <GreenlightPanel
        greenlight={run}
        loading={false}
        error={new ApiError('timeout', 'slow')}
        onRetry={onRetry}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Check again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('advances progress through scoring and narrative phases', () => {
    vi.useFakeTimers();
    const view = wrap(<GreenlightPanel greenlight={null} loading={true} error={null} />);
    act(() => {
      vi.advanceTimersByTime(26_000);
    });
    expect(document.querySelector('.is-done')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(21_000);
    });
    view.unmount();
    vi.useRealTimers();
  });

  it('shows a billing error banner', () => {
    wrap(<GreenlightPanel greenlight={null} loading={false} error={new ApiError('gemini_billing', 'quota')} />);
    expect(screen.getByText(/quota|billing|Gemini/i)).toBeInTheDocument();
  });

  it('shows empty recommendations or the memo text', () => {
    wrap(
      <GreenlightPanel
        greenlight={{ ...run, recommendations: [], queryRows: [], steps: [] }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText('Weekly memo')).toBeInTheDocument();
  });

  it('shows the empty state when there is no answer', () => {
    wrap(
      <GreenlightPanel
        greenlight={{ ...run, answer: '', recommendations: [], queryRows: [], steps: [] }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('collapses evidence by default when requested', () => {
    wrap(<GreenlightPanel greenlight={run} loading={false} error={null} collapseEvidenceDefault />);
    expect(screen.queryByText(/ClickHouse analytics|Analítica ClickHouse/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show evidence/i }));
    expect(screen.getByText(/ClickHouse analytics|Analítica ClickHouse/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hide evidence/i }));
    expect(screen.queryByText(/ClickHouse analytics|Analítica ClickHouse/i)).not.toBeInTheDocument();
  });

  it('labels catalog depth-fill picks', () => {
    wrap(
      <GreenlightPanel
        greenlight={{
          ...run,
          recommendations: [
            {
              title: 'Fading Line 75',
              genre: 'Drama',
              justification: 'depth fill',
              evidence: 'gap',
              opportunity_score: 0.11,
              wow_pct: 0.02,
              genre_gap: 0.05,
              in_cannibal_pair: false
            }
          ]
        }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getAllByText(/catalog depth fill/i).length).toBeGreaterThan(0);
  });

  it('previews a formula playground slate from DISCOVER rows', () => {
    wrap(<GreenlightPanel greenlight={run} loading={false} error={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Show Formula Playground/i }));
    expect(screen.getByText(/Rivals hide ranking in the LLM/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Reset to production formula/i }));
    expect(screen.getAllByText(/Crimen sin Fronteras/).length).toBeGreaterThan(0);
    screen.getAllByRole('slider').forEach(slider => {
      fireEvent.change(slider, { target: { value: '0.1' } });
    });
    fireEvent.click(screen.getByLabelText(/Relax cannibal exclusion/i));
    fireEvent.click(screen.getByLabelText(/Relax genre diversity/i));
  });

  it('shows Formula Playground unavailable copy without DISCOVER rows', () => {
    wrap(
      <GreenlightPanel
        greenlight={{ ...run, steps: [], cannibalExcluded: undefined, runnerUp: undefined }}
        loading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Show Formula Playground/i }));
    expect(screen.getByText(/Playground unavailable/i)).toBeInTheDocument();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: /Review slate/i }));
    expect(screen.getAllByText(/No near-duplicate conflict this week/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    fireEvent.click(screen.getByRole('button', { name: /Review slate/i }));
    fireEvent.click(screen.getByRole('button', { name: /Download CSV/i }));
    expect(screen.getByText(/Slate downloaded/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review slate/i }));
    fireEvent.click(screen.getByRole('button', { name: /Download JSON/i }));
    click.mockRestore();
  });

  it('shows runner-up whyLost and wow contribution in the review flow', () => {
    wrap(
      <GreenlightPanel
        greenlight={{
          ...run,
          queryRows: [
            {
              title: 'Crimen sin Fronteras: Bogotá',
              opportunity_score: 0.268,
              wow_pct: 0.32,
              wow_momentum: 0.91,
              genre_gap: 0.135,
              in_cannibal_pair: false
            }
          ],
          runnerUp: {
            title: 'Shadow Protocol',
            genre: 'Thriller',
            opportunity_score: 0.24,
            whyLost: 'diversity'
          }
        }}
        loading={false}
        error={null}
      />
    );
    fireEvent.click(document.querySelector('.rec-provenance-details summary') as HTMLElement);
    expect(screen.getByText(/Shadow Protocol/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Review slate/i }));
    expect(screen.getAllByText(/0.364/).length).toBeGreaterThan(0);
  });

  it('shows em dash in slate review when opportunity_score is missing', () => {
    wrap(
      <GreenlightPanel
        greenlight={{
          ...run,
          queryRows: undefined,
          recommendations: [
            { title: 'No Score Title', genre: 'Drama', justification: '', evidence: '' }
          ],
          cannibalExcluded: undefined
        }}
        loading={false}
        error={null}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Review slate/i }));
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('labels a cannibal runner-up in provenance', () => {
    wrap(
      <GreenlightPanel
        greenlight={{
          ...run,
          runnerUp: {
            title: 'True Crime: Highway 101',
            genre: 'Documentary',
            opportunity_score: 0.22,
            whyLost: 'cannibal'
          }
        }}
        loading={false}
        error={null}
      />
    );
    fireEvent.click(document.querySelector('.rec-provenance-details summary') as HTMLElement);
    expect(screen.getByText(/near-duplicate cannibal pair/i)).toBeInTheDocument();
  });

  it('shows skipped Gemini status when the payload has no geminiStatus', () => {
    wrap(
      <GreenlightPanel
        greenlight={{ ...run, geminiStatus: undefined, mcpMs: undefined, geminiMs: undefined }}
        loading={false}
        error={null}
      />
    );
    expect(screen.getByText(/Gemini skipped/i)).toBeInTheDocument();
  });
});

describe('SlateReviewFlow', () => {
  it('reviews, confirms from both phases, and lists cannibal exclusions', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    wrap(
      <SlateReviewFlow
        greenlight={{
          ...run,
          queryRows: undefined,
          recommendations: [
            { title: undefined as unknown as string, genre: 'Drama', justification: '', evidence: '' },
            { title: 'No Score Title', genre: 'Drama', justification: '', evidence: '' }
          ]
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Review slate/i }));
    expect(screen.getAllByText(/True Crime: Highway 101/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Download CSV/i }));
    expect(screen.getByText(/Slate downloaded/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Download CSV/i }));
    fireEvent.click(screen.getByRole('button', { name: /Download JSON/i }));
    click.mockRestore();
  });
});
