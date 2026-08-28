import { useEffect, useState } from 'react';
import { api, CatalogEntry } from '../api';
import { PageHeader, Card, Loading, ErrorBanner } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';

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
      .catch(e => setError(e instanceof Error ? e.message : t('catalog.loadError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount
  }, []);

  const filtered = entries.filter(
    e =>
      !filter ||
      e.title.toLowerCase().includes(filter.toLowerCase()) ||
      e.genre.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} />;

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
                    <br />
                    <span className="muted small">{e.description.slice(0, 80)}…</span>
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
