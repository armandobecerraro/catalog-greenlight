import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, AgentRunResult, CatalogStats } from '../api';
import { GreenlightPanel } from '../components/GreenlightPanel';
import { TrustStrip } from '../components/TrustStrip';
import { WeekSignalsPanel } from '../components/WeekSignalsPanel';
import { PageHeader, Card, Loading, ErrorBanner } from '../components/Layout';
import { useHealthPoll } from '../hooks/useHealthPoll';
import { useLocale } from '../i18n/LocaleContext';
import { formatApiError } from '../utils/apiErrors';

export default function Dashboard() {
  const { t } = useLocale();
  const location = useLocation();
  const { health, waking } = useHealthPoll();
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [greenlight, setGreenlight] = useState<AgentRunResult | null>(null);
  const [statsError, setStatsError] = useState<unknown>(null);
  const [greenlightError, setGreenlightError] = useState<unknown>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [greenlightLoading, setGreenlightLoading] = useState(true);
  const [greenlightRefreshing, setGreenlightRefreshing] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const healthReady = Boolean(health?.ready) && !waking;
  const refreshBusy = greenlightLoading || greenlightRefreshing;

  const loadGreenlight = useCallback(async (opts?: { refresh?: boolean }) => {
    const refresh = opts?.refresh ?? false;
    if (refresh) {
      setGreenlightRefreshing(true);
      setGreenlightError(null);
    } else {
      setGreenlightLoading(true);
    }

    try {
      const result = await api.getGreenlight({ refresh });
      setGreenlight(result);
      setGreenlightError(null);
    } catch (e) {
      setGreenlightError(e);
    } finally {
      if (refresh) setGreenlightRefreshing(false);
      else setGreenlightLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(e => setStatsError(e))
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    loadGreenlight();
  }, [loadGreenlight]);

  useEffect(() => {
    if (location.hash !== '#greenlight') return;
    const el = document.getElementById('greenlight');
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location.hash, greenlightLoading]);

  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitleHero')} />

      <TrustStrip health={health} />

      <Card id="greenlight" className="greenlight-panel greenlight-hero">
        <div className="panel-head panel-head-greenlight">
          <h3>{t('dashboard.greenlightTitle')}</h3>
          <div className="panel-head-actions">
            {greenlight?.model && <span className="badge">{greenlight.model}</span>}
            <button
              type="button"
              className="btn secondary greenlight-refresh-btn"
              onClick={() => loadGreenlight({ refresh: true })}
              disabled={!healthReady || refreshBusy}
              title={!healthReady ? t('dashboard.refreshDisabledTooltip') : undefined}
              aria-busy={greenlightRefreshing}
            >
              {greenlightRefreshing ? t('dashboard.refreshingGreenlight') : t('dashboard.refreshGreenlight')}
            </button>
          </div>
        </div>
        {greenlightRefreshing && (
          <div className="greenlight-refresh-banner" role="status" aria-live="polite">
            {t('dashboard.refreshingGreenlight')}
          </div>
        )}
        <GreenlightPanel
          greenlight={greenlight}
          loading={refreshBusy}
          error={greenlightError}
          collapseEvidenceDefault
          onRetry={() => loadGreenlight({ refresh: true })}
        />
      </Card>

      <section className="dashboard-snapshot">
        <button
          type="button"
          className="btn secondary dashboard-snapshot-toggle"
          aria-expanded={snapshotOpen}
          onClick={() => setSnapshotOpen(open => !open)}
        >
          {snapshotOpen ? t('dashboard.hideSnapshot') : t('dashboard.showSnapshot')}
        </button>

        {snapshotOpen && (
          <>
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
          </>
        )}
      </section>
    </>
  );
}
