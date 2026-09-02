import { FormEvent, useState } from 'react';
import { api } from '../api';
import { PageHeader, Card, ErrorBanner, Link } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { formatApiError } from '../utils/apiErrors';

export default function Ingest() {
  const { t } = useLocale();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Sci-Fi');
  const [releaseDate, setReleaseDate] = useState('2024-06-01');
  const [cast, setCast] = useState('');
  const [result, setResult] = useState<{ contentId: string; latencyMs: number } | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const r = await api.ingest({
        title,
        description,
        genre,
        releaseDate,
        cast: cast
          .split(',')
          .map(c => c.trim())
          .filter(Boolean)
      });
      setResult({ contentId: r.contentId, latencyMs: r.latencyMs });
    } catch (err) {
      setError(formatApiError(t, err, 'ingest.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title={t('ingest.title')} subtitle={t('ingest.subtitle')} />
      <Card>
        <form className="form" onSubmit={onSubmit}>
          <label className="form-first-field">
            {t('ingest.labelTitle')}
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              autoComplete="off"
              placeholder={t('ingest.titlePlaceholder')}
            />
          </label>
          <label>
            {t('ingest.labelDescription')}
            <textarea
              className="input"
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </label>
          <label>
            {t('ingest.labelGenre')}
            <select className="input" value={genre} onChange={e => setGenre(e.target.value)}>
              {['Sci-Fi', 'Drama', 'Comedy', 'Horror', 'Romance', 'Action', 'Thriller', 'Documentary', 'Animation'].map(
                g => (
                  <option key={g}>{g}</option>
                )
              )}
            </select>
          </label>
          <label>
            {t('ingest.labelRelease')}
            <input
              className="input"
              type="date"
              value={releaseDate}
              onChange={e => setReleaseDate(e.target.value)}
              required
            />
          </label>
          <label>
            {t('ingest.labelCast')}
            <input
              className="input"
              value={cast}
              onChange={e => setCast(e.target.value)}
              placeholder={t('ingest.castPlaceholder')}
              required
            />
          </label>
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? t('ingest.submitting') : t('ingest.submit')}
          </button>
        </form>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div className="success">
            {t('ingest.success', { id: result.contentId, ms: result.latencyMs })}{' '}
            <Link to="/catalog">{t('ingest.viewCatalog')}</Link>
          </div>
        )}
      </Card>
    </>
  );
}
