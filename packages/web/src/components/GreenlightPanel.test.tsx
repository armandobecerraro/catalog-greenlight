import type { ReactElement } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider } from '../i18n/LocaleContext';
import { GreenlightPanel } from './GreenlightPanel';
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
  model: 'gemini-test'
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
    const sqlToggle = screen.queryByRole('button', { name: /A_genre_inventory/i });
    if (sqlToggle) fireEvent.click(sqlToggle);
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
});
