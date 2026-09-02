import { useEffect, useState } from 'react';
import { api, CatalogEntry } from '../api';
import { PageHeader, Card, Loading, ErrorBanner, EmptyState, Link } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { formatApiError } from '../utils/apiErrors';
import { isPaddingTitle, formatCast } from '../utils/greenlightMetrics';

export default function Catalog() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const [hidePadding, setHidePadding] = useState(true);

  useEffect(() => {
    api
      .getCatalog()
      .then(r => setEntries(r.entries))
      .catch(e => setError(formatApiError(t, e, 'catalog.loadError')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e => {
    if (hidePadding && isPaddingTitle(e.title, e.description)) return false;
    if (!filter) return true;
    return (
      e.title.toLowerCase().includes(filter.toLowerCase()) ||
      e.genre.toLowerCase().includes(filter.toLowerCase())
    );
  });

  if (loading) {
    return (
      <>
        <PageHeader title={t('catalog.title')} />
        <Card>
          <Loading />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle', { count: 0 })} />
        <ErrorBanner message={error} />
      </>
    );
  }

  if (entries.length === 0) {
    return (
      <>
        <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle', { count: 0 })} />
        <Card>
          <EmptyState
            title={t('empty.catalog.title')}
            body={t('empty.catalog.body')}
            action={<Link to="/ingest">{t('empty.catalog.cta')}</Link>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle', { count: filtered.length })} />
      <Card>
        <div className="catalog-toolbar">
          <input
            className="input"
            placeholder={t('catalog.filterPlaceholder')}
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <label className="catalog-padding-toggle">
            <input
              type="checkbox"
              checked={hidePadding}
              onChange={e => setHidePadding(e.target.checked)}
            />
            {t('catalog.hidePadding')}
          </label>
        </div>
        <div className="table-wrap catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>{t('catalog.colTitle')}</th>
                <th>{t('catalog.colGenre')}</th>
                <th>{t('catalog.colRelease')}</th>
                <th>{t('catalog.colCast')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.title}</strong>
                    {e.description ? (
                      <>
                        <br />
                        <span className="muted small">
                          {e.description.slice(0, 80)}
                          {e.description.length > 80 ? '…' : ''}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>
                    <span className="genre-pill">{e.genre}</span>
                  </td>
                  <td>{e.releaseDate}</td>
                  <td className="small">{formatCast(e.cast)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
