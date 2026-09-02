import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, CatalogStats as CatalogStatsData } from '../api';
import { PageHeader, Card, Loading, ErrorBanner } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { formatApiError } from '../utils/apiErrors';

export default function CatalogStats() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CatalogStatsData | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(e => setError(e))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title={t('catalogStats.title')} subtitle={t('catalogStats.subtitle')} />
      <p className="catalog-stats-nav muted">
        <Link to="/catalog">{t('catalogStats.backToCatalog')}</Link>
        {' · '}
        <Link to="/">{t('catalogStats.backToDashboard')}</Link>
      </p>

      {error != null && (
        <ErrorBanner message={formatApiError(t, error, 'dashboard.statsError')} />
      )}

      {loading ? (
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
                .slice(0, 8)
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
  );
}
