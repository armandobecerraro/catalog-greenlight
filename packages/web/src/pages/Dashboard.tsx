import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, AgentRunResult, CatalogStats, Recommendation } from '../api';
import { PageHeader, Card, Loading, ErrorBanner, AgentTimeline } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { normalizeTitle } from '../utils/greenlightMetrics';

function metricsForRec(rec: Recommendation, queryRows: Record<string, unknown>[]) {
  const fromRec = {
    opportunity_score: rec.opportunity_score,
    wow_pct: rec.wow_pct,
    genre_gap: rec.genre_gap,
    in_cannibal_pair: rec.in_cannibal_pair
  };
  const row = queryRows.find(r => typeof r.title === 'string' && normalizeTitle(String(r.title)) === normalizeTitle(rec.title));
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

export default function Dashboard() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [greenlight, setGreenlight] = useState<AgentRunResult | null>(null);
  const [statsError, setStatsError] = useState('');
  const [greenlightError, setGreenlightError] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [greenlightLoading, setGreenlightLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(e => setStatsError(e instanceof Error ? e.message : t('dashboard.statsError')))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    api
      .getGreenlight()
      .then(setGreenlight)
      .catch(e => setGreenlightError(e instanceof Error ? e.message : t('dashboard.greenlightError')))
      .finally(() => setGreenlightLoading(false));
  }, []);

  const queryRows = (greenlight?.queryRows ?? []) as Record<string, unknown>[];

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      {statsError && <ErrorBanner message={statsError} />}

      {statsLoading ? (
        <Card>
          <Loading />
        </Card>
      ) : (
        <div className="grid-3">
          <Card>
            <h3>{t('dashboard.catalogSize')}</h3>
            <p className="stat-value">{stats?.totalEntries ?? 0}</p>
            <p className="muted">{t('dashboard.addedLast30', { count: stats?.recentAdditions ?? 0 })}</p>
          </Card>
          <Card>
            <h3>{t('dashboard.genresTracked')}</h3>
            <p className="stat-value">{Object.keys(stats?.genres ?? {}).length}</p>
            <ul className="genre-list">
              {Object.entries(stats?.genres ?? {})
                .slice(0, 5)
                .map(([g, c]) => (
                  <li key={g}>
                    {g}: {c}
                  </li>
                ))}
            </ul>
          </Card>
          <Card>
            <h3>{t('dashboard.latestRevenue')}</h3>
            {stats?.latestRevenue ? (
              <>
                <p className="stat-value">${stats.latestRevenue.totalRevenueUsd.toFixed(0)}</p>
                <p className="muted">
                  {stats.latestRevenue.totalViews.toLocaleString()} {t('common.views')}
                </p>
                <p className="muted">
                  {t('common.top')}: {stats.latestRevenue.topTitle}
                </p>
              </>
            ) : (
              <p className="muted">{t('dashboard.noRevenue')}</p>
            )}
          </Card>
        </div>
      )}

      <Card className="greenlight-panel">
        <div className="panel-head">
          <h3>{t('dashboard.greenlightTitle')}</h3>
          {greenlight?.model && <span className="badge">{greenlight.model}</span>}
        </div>
        {greenlightLoading && <p className="muted">{t('dashboard.greenlightLoading')}</p>}
        {greenlightError && <ErrorBanner message={greenlightError} />}
        {!greenlightLoading && greenlight?.recommendations && greenlight.recommendations.length > 0 ? (
          <div className="rec-grid">
            {greenlight.recommendations.map((r, i) => {
              const metrics = metricsForRec(r, queryRows);
              return (
                <article key={i} className="rec-card">
                  <h4>{r.title}</h4>
                  <span className="genre-pill">{r.genre}</span>
                  <dl className="rec-metrics">
                    <div>
                      <dt>{t('dashboard.metricScore')}</dt>
                      <dd>{metrics.opportunity_score?.toFixed(3) ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('dashboard.metricWow')}</dt>
                      <dd>{formatPct(metrics.wow_pct)}</dd>
                    </div>
                    <div>
                      <dt>{t('dashboard.metricGenreGap')}</dt>
                      <dd>{metrics.genre_gap?.toFixed(3) ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t('dashboard.metricCannibal')}</dt>
                      <dd>{metrics.in_cannibal_pair ? 'yes' : 'no'}</dd>
                    </div>
                  </dl>
                  <p>{r.justification}</p>
                  <p className="evidence">
                    {t('common.evidence')}: {r.evidence}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          !greenlightLoading && greenlight?.answer && <p>{greenlight.answer}</p>
        )}
        {greenlight && (
          <>
            <p className="muted">
              {t('dashboard.agentRun', { ms: greenlight.totalLatencyMs })} ·{' '}
              <Link to="/ask">{t('dashboard.followUp')}</Link>
            </p>
            {greenlight.steps && <AgentTimeline steps={greenlight.steps} />}
          </>
        )}
      </Card>
    </>
  );
}
