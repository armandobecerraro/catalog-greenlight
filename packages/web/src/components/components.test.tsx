import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LocaleProvider, useLocale } from '../i18n/LocaleContext';
import { DataTable } from './DataTable';
import { AgentTimeline } from './AgentTimeline';
import { StepOutput } from './StepOutput';
import { Card, EmptyState, ErrorBanner, Loading, PageHeader } from './Layout';
import { GreenlightSlateBar } from './GreenlightSlateBar';
import type { AgentRunResult } from '../api';

function wrap(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <LocaleProvider>{ui}</LocaleProvider>
    </MemoryRouter>
  );
}

describe('layout primitives', () => {
  it('renders header, card, banners, and loading', () => {
    wrap(
      <>
        <PageHeader title="Hello" subtitle="Sub" />
        <Card>
          <EmptyState title="Empty" body="Nothing" action={<button type="button">Go</button>} />
        </Card>
        <ErrorBanner message="Boom" />
        <Loading />
      </>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('Empty')).toBeInTheDocument();
  });

  it('throws when useLocale is used outside the provider', () => {
    function Boom() {
      useLocale();
      return null;
    }
    expect(() => render(<Boom />)).toThrow(/LocaleProvider/);
  });
});

describe('DataTable', () => {
  it('returns null for empty rows', () => {
    const { container } = wrap(<DataTable rows={[]} />);
    expect(container.querySelector('table')).toBeNull();
  });

  it('formats cells and shows overflow count', () => {
    wrap(
      <DataTable
        maxRows={1}
        rows={[
          { n: 1.5, ok: true, missing: null, obj: { a: 1 } },
          { n: 2, ok: false, missing: 'x', obj: null }
        ]}
      />
    );
    expect(screen.getByText('1.5')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('AgentTimeline and StepOutput', () => {
  it('expands step output variants', () => {
    wrap(
      <AgentTimeline
        steps={[
          { step: 'INTENT', status: 'running', output: { intent: 'catalog_qa', source: 'gemini' } },
          { step: 'DISCOVER', status: 'completed', output: { schema: 'media_catalog.t(id UUID)' } },
          {
            step: 'DISCOVER',
            status: 'completed',
            output: {
              queries: [{ id: 'A', sql: 'SELECT 1', rowCount: 1, latencyMs: 2, rows: [{ x: 1 }] }]
            }
          },
          { step: 'PLAN_SQL', status: 'completed', output: { formula: 'opp', candidateCount: 3, momentumRowsScored: 10, topCandidates: [{ title: 'T' }] } },
          { step: 'EXECUTE', status: 'completed', output: { attempts: [{ sql: 'SELECT 1', rowCount: 1, retry: true }], rows: [{ g: 'Drama' }] } },
          { step: 'SYNTHESIZE', status: 'completed', output: { answer: 'memo', fallback: true, geminiError: 'timeout', recommendations: [{ title: 'T' }] } },
          { step: 'AUDIT', status: 'completed', output: { auditId: 'r1' } },
          { step: 'INTENT', status: 'error', error: 'boom', output: null }
        ]}
      />
    );
    const toggles = screen.getAllByRole('button');
    toggles.forEach(btn => fireEvent.click(btn));
    expect(screen.getAllByText(/catalog_qa|gemini|memo|r1|boom/i).length).toBeGreaterThan(0);
  });

  it('renders string, primitive, and missing output', () => {
    wrap(
      <>
        <StepOutput step="INTENT" output="plain" />
        <StepOutput step="INTENT" output={3} />
        <StepOutput step="INTENT" output={null} />
      </>
    );
    expect(screen.getByText('plain')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('GreenlightSlateBar', () => {
  const run: AgentRunResult = {
    intent: 'greenlight',
    answer: 'memo',
    recommendations: [{ title: 'A', genre: 'Thriller', justification: 'j', evidence: 'e' }],
    steps: [],
    totalLatencyMs: 1,
    model: 'x'
  };

  it('renders export actions when recommendations exist', () => {
    wrap(<GreenlightSlateBar greenlight={run} />);
    expect(screen.getByText(/Gemini did not invent the ranking/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
  });

  it('renders nothing without titled recommendations', () => {
    wrap(<GreenlightSlateBar greenlight={{ ...run, recommendations: [{ title: '  ', genre: 'Drama', justification: '', evidence: '' }] }} />);
    expect(screen.queryByText(/Gemini did not invent the ranking/i)).not.toBeInTheDocument();
  });

  it('renders nothing for an empty recommendations list', () => {
    wrap(<GreenlightSlateBar greenlight={{ ...run, recommendations: [] }} />);
    expect(screen.queryByText(/Gemini did not invent the ranking/i)).not.toBeInTheDocument();
  });

  it('renders nothing when recommendations are undefined', () => {
    wrap(<GreenlightSlateBar greenlight={{ ...run, recommendations: undefined }} />);
    expect(screen.queryByText(/Gemini did not invent the ranking/i)).not.toBeInTheDocument();
  });
});
