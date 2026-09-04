import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AgentRunResult, Recommendation } from '../api';
import AnalyticsInsights from './AnalyticsInsights';
import { AgentTimeline } from './AgentTimeline';
import { GreenlightRitualPanel } from './GreenlightRitualPanel';
import { GreenlightProvenanceHeader, RecProvenance, RecProvenanceStrip, FillerDepthBadge } from './GreenlightProvenance';
import { GreenlightSlateBar } from './GreenlightSlateBar';
import { McpSqlEvidence } from './McpSqlEvidence';
import { ErrorBanner, EmptyState } from './Layout';
import { useLocale } from '../i18n/LocaleContext';
import { parseGreenlightAnalytics } from '../utils/greenlightAnalytics';
import { normalizeTitle } from '../utils/greenlightMetrics';
import {
  greenlightPhaseFromElapsed,
  resolveGreenlightErrorMessage,
  topCandidatesFromSteps,
  usedScorerFallback,
  type GreenlightPhase
} from '../utils/greenlightUx';

function metricsForRec(rec: Recommendation, queryRows: Record<string, unknown>[]) {
  const fromRec = {
    opportunity_score: rec.opportunity_score,
    wow_pct: rec.wow_pct,
    genre_gap: rec.genre_gap,
    in_cannibal_pair: rec.in_cannibal_pair
  };
  const row = queryRows.find(
    r => typeof r.title === 'string' && normalizeTitle(String(r.title)) === normalizeTitle(rec.title)
  );
  if (!row) return fromRec;
  return {
    opportunity_score: fromRec.opportunity_score ?? num(row, 'opportunity_score'),
    wow_pct: fromRec.wow_pct ?? num(row, 'wow_pct'),
    genre_gap: fromRec.genre_gap ?? num(row, 'genre_gap'),
    in_cannibal_pair: fromRec.in_cannibal_pair ?? bool(row, 'in_cannibal_pair')
  };
}

function num(row: Record<string, unknown>, key: string): number | undefined {
  const v = row[key];
  return typeof v === 'number' ? v : undefined;
}

function bool(row: Record<string, unknown>, key: string): boolean | undefined {
  const v = row[key];
  return typeof v === 'boolean' ? v : undefined;
}

function formatPct(value: number | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function useGreenlightPhase(loading: boolean): GreenlightPhase {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 400);
    return () => window.clearInterval(id);
  }, [loading]);

  return greenlightPhaseFromElapsed(elapsed);
}

const PHASES: GreenlightPhase[] = ['measuring', 'scoring', 'narrative'];

function phaseLabel(phase: GreenlightPhase, t: (key: string) => string): string {
  switch (phase) {
    case 'measuring':
      return t('dashboard.greenlightProgressMeasuring');
    case 'scoring':
      return t('dashboard.greenlightProgressScoring');
    case 'narrative':
      return t('dashboard.greenlightProgressNarrative');
  }
}

function phaseStatus(
  phase: GreenlightPhase,
  current: GreenlightPhase
): 'done' | 'active' | 'pending' {
  const currentIdx = PHASES.indexOf(current);
  const phaseIdx = PHASES.indexOf(phase);
  if (phaseIdx < currentIdx) return 'done';
  if (phaseIdx === currentIdx) return 'active';
  return 'pending';
}

function SkeletonBar({ width }: { width: string }) {
  return <span className="skeleton skeleton-bar" style={{ width }} aria-hidden="true" />;
}

function RecCardSkeleton({ index }: { index: number }) {
  return (
    <article className="rec-card rec-card-skeleton" aria-hidden="true">
      <SkeletonBar width="72%" />
      <span className="skeleton skeleton-pill" />
      <dl className="rec-metrics">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <dt>
              <SkeletonBar width="80%" />
            </dt>
            <dd>
              <SkeletonBar width="55%" />
            </dd>
          </div>
        ))}
      </dl>
      <SkeletonBar width="100%" />
      <SkeletonBar width="88%" />
      <span className="sr-only">Loading recommendation {index + 1}</span>
    </article>
  );
}

function GreenlightProgress({ phase }: { phase: GreenlightPhase }) {
  const { t } = useLocale();

  return (
    <div className="greenlight-progress" role="status" aria-live="polite">
      <p className="greenlight-progress-lead">{phaseLabel(phase, t)}</p>
      <ol className="greenlight-progress-steps">
        {PHASES.map(p => {
          const status = phaseStatus(p, phase);
          return (
            <li key={p} className={`greenlight-progress-step is-${status}`}>
              <span className="greenlight-progress-dot" aria-hidden="true" />
              <span>{phaseLabel(p, t)}</span>
            </li>
          );
        })}
      </ol>
      <p className="muted greenlight-progress-hint">{t('dashboard.greenlightProgressHint')}</p>
    </div>
  );
}

function RecMetrics({
  metrics,
  t
}: {
  metrics: ReturnType<typeof metricsForRec>;
  t: (key: string) => string;
}) {
  return (
    <dl className="rec-metrics">
      <div>
        <dt>{t('dashboard.metricScore')}</dt>
        <dd>{metrics.opportunity_score != null ? metrics.opportunity_score.toFixed(3) : '—'}</dd>
      </div>
      <div>
        <dt>{t('dashboard.metricWow')}</dt>
        <dd>{formatPct(metrics.wow_pct)}</dd>
      </div>
      <div>
        <dt>{t('dashboard.metricGenreGap')}</dt>
        <dd>{metrics.genre_gap != null ? metrics.genre_gap.toFixed(3) : '—'}</dd>
      </div>
      <div>
        <dt>{t('dashboard.metricCannibal')}</dt>
        <dd>{metrics.in_cannibal_pair ? t('dashboard.metricYes') : t('dashboard.metricNo')}</dd>
      </div>
    </dl>
  );
}

function RecCard({
  rec,
  queryRows,
  narrativePending
}: {
  rec: Recommendation;
  queryRows: Record<string, unknown>[];
  narrativePending?: boolean;
}) {
  const { t } = useLocale();
  const metrics = metricsForRec(rec, queryRows);
  const hasNarrative = Boolean(rec.justification?.trim());

  return (
    <article className="rec-card">
      <RecProvenanceStrip rec={rec} queryRows={queryRows} />
      <h4>{rec.title}</h4>
      <div className="rec-card-meta">
        {rec.genre && <span className="genre-pill">{rec.genre}</span>}
        <FillerDepthBadge title={rec.title} />
      </div>
      <RecMetrics metrics={metrics} t={t} />
      <details className="rec-provenance-details">
        <summary>{t('greenlight.provenanceTitle')}</summary>
        <RecProvenance rec={rec} queryRows={queryRows} />
      </details>
      {narrativePending && !hasNarrative ? (
        <p className="rec-narrative-pending muted">{t('dashboard.greenlightPartialNarrative')}</p>
      ) : (
        <>
          {rec.justification && <p>{rec.justification}</p>}
          {rec.evidence && (
            <p className="evidence">
              {t('common.evidence')}: {rec.evidence}
            </p>
          )}
        </>
      )}
    </article>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="warning-banner" role="alert">
      <p>{message}</p>
    </div>
  );
}

export function GreenlightPanel({
  greenlight,
  loading,
  error,
  collapseEvidenceDefault = false,
  onRetry
}: {
  greenlight: AgentRunResult | null;
  loading: boolean;
  error: unknown;
  /** When true, SQL / analytics / timeline start collapsed behind “Show evidence”. */
  collapseEvidenceDefault?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useLocale();
  const [showEvidence, setShowEvidence] = useState(!collapseEvidenceDefault);
  const phase = useGreenlightPhase(loading);
  const queryRows = (greenlight?.queryRows ?? []) as Record<string, unknown>[];
  const analytics = useMemo(() => parseGreenlightAnalytics(greenlight), [greenlight]);

  const recommendations = (greenlight?.recommendations ?? []).filter(r => Boolean(r.title?.trim()));
  const partialCandidates =
    recommendations.length === 0 ? topCandidatesFromSteps(greenlight).filter(r => Boolean(r.title?.trim())) : [];
  const displayRecs = recommendations.length > 0 ? recommendations : partialCandidates;
  const showPartialOnly = recommendations.length === 0 && partialCandidates.length > 0;

  const fallbackUsed = usedScorerFallback(greenlight);

  const resolvedError = error ? resolveGreenlightErrorMessage(error, t) : null;
  const hasCachedSlate = displayRecs.length > 0;
  const isInitialLoad = loading && !hasCachedSlate;
  const isRefreshingWithCache = loading && hasCachedSlate;

  return (
    <>
      {isInitialLoad && (
        <>
          <GreenlightProgress phase={phase} />
          <div className="rec-grid" aria-busy="true">
            {[0, 1, 2].map(i => (
              <RecCardSkeleton key={i} index={i} />
            ))}
          </div>
        </>
      )}

      {isRefreshingWithCache && <GreenlightProgress phase={phase} />}

      {resolvedError && !isInitialLoad && (
        <>
          <ErrorBanner
            message={
              resolvedError.title
                ? `${resolvedError.title}: ${resolvedError.message}`
                : resolvedError.message
            }
          />
          {onRetry && (
            <button type="button" className="btn secondary greenlight-retry-btn" onClick={onRetry}>
              {t('health.retry')}
            </button>
          )}
        </>
      )}

      {!loading && fallbackUsed && displayRecs.length > 0 && (
        <WarningBanner message={t('dashboard.greenlightFallbackNotice')} />
      )}

      {hasCachedSlate && !isInitialLoad && (
        <>
          <p className="slate-attribution greenlight-hero-attribution">
            {t('greenlight.clickhouseAttribution')}
          </p>
          <div
            className={`rec-grid greenlight-rec-hero${isRefreshingWithCache ? ' is-cached-dimmed' : ''}`}
            aria-busy={isRefreshingWithCache}
          >
            {displayRecs.map((r, i) => (
              <RecCard
                key={`${r.title}-${i}`}
                rec={r}
                queryRows={queryRows}
                narrativePending={showPartialOnly}
              />
            ))}
          </div>
        </>
      )}

      {!loading && greenlight && displayRecs.length > 0 && recommendations.length > 0 && (
        <GreenlightSlateBar greenlight={greenlight} />
      )}

      {!loading && greenlight && displayRecs.length > 0 && (
        <GreenlightProvenanceHeader greenlight={greenlight} />
      )}

      {!loading && recommendations.length > 0 && !showPartialOnly && greenlight && (
        <GreenlightRitualPanel greenlight={greenlight} />
      )}

      {!loading && displayRecs.length === 0 && !error && (
        greenlight?.answer ? (
          <p>{greenlight.answer}</p>
        ) : (
          <EmptyState
            title={t('empty.recommendations.title')}
            body={t('empty.recommendations.body')}
          />
        )
      )}

      {greenlight && !loading && (
        <div className="evidence-disclosure">
          <button
            type="button"
            className="btn secondary evidence-toggle"
            aria-expanded={showEvidence}
            onClick={() => setShowEvidence(v => !v)}
          >
            {showEvidence ? t('dashboard.hideEvidence') : t('dashboard.showEvidence')}
          </button>
          {showEvidence && (
            <>
              {analytics && <AnalyticsInsights analytics={analytics} />}
              <McpSqlEvidence greenlight={greenlight} />
              <p className="muted">
                {t('dashboard.agentRun', { ms: greenlight.totalLatencyMs })} ·{' '}
                <Link to="/ask">{t('dashboard.followUp')}</Link>
              </p>
              {greenlight.steps && <AgentTimeline steps={greenlight.steps} />}
            </>
          )}
        </div>
      )}
    </>
  );
}
