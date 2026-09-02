import { useEffect, useState } from 'react';
import { api, CatalogEntry } from '../api';
import { PageHeader, Card, Loading, ErrorBanner, EmptyState, Link } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { formatApiError } from '../utils/apiErrors';

export default function Catalog() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api
      .getCatalog()
      .then(r => setEntries(r.entries))
      .catch(e => setError(formatApiError(t, e, 'catalog.loadError')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = entries.filter(
    e =>
      !filter ||
      e.title.toLowerCase().includes(filter.toLowerCase()) ||
      e.genre.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

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
      <PageHeader title={t('catalog.title')} subtitle={t('catalog.subtitle', { count: entries.length })} />
      <Card>
        <input
          className="input"
          placeholder={t('catalog.filterPlaceholder')}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <div className="table-wrap">
          <table>
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
                  <td className="small">{e.cast.slice(0, 3).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
