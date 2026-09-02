import { useEffect, useState } from 'react';
import { api, AgentRunResult, CatalogStats, HealthStatus } from '../api';
import { GreenlightPanel } from '../components/GreenlightPanel';
import { WeekSignalsPanel } from '../components/WeekSignalsPanel';
import { PageHeader, Card, Loading, ErrorBanner } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { formatApiError } from '../utils/apiErrors';

export default function Dashboard() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [greenlight, setGreenlight] = useState<AgentRunResult | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [statsError, setStatsError] = useState<unknown>(null);
  const [greenlightError, setGreenlightError] = useState<unknown>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [greenlightLoading, setGreenlightLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(e => setStatsError(e))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    api
      .getGreenlight()
      .then(setGreenlight)
      .catch(e => setGreenlightError(e))
      .finally(() => setGreenlightLoading(false));
  }, []);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />

      <div className="live-strip" role="status">
        <p>{t('dashboard.liveStrip')}</p>
        {health?.partners && (
          <p className="live-strip-meta muted small">
            {t('dashboard.liveClickhouse', { status: health.partners.clickhouse ?? 'starting' })}
            {' · '}
            {t('dashboard.liveMcp', { server: health.partners.mcp ?? 'mcp-clickhouse' })}
          </p>
        )}
      </div>

      <WeekSignalsPanel
        stats={stats}
        greenlight={greenlight}
        statsLoading={statsLoading}
        greenlightLoading={greenlightLoading}
      />

      {statsError != null && (
        <ErrorBanner message={formatApiError(t, statsError, 'dashboard.statsError')} />
      )}

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
        <GreenlightPanel greenlight={greenlight} loading={greenlightLoading} error={greenlightError} />
      </Card>
    </>
  );
}
