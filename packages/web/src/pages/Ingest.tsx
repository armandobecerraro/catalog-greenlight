import { FormEvent, useState } from 'react';
import { api } from '../api';
import { PageHeader, Card, ErrorBanner } from '../components/Layout';

export default function Ingest() {
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
        cast: cast.split(',').map(c => c.trim()).filter(Boolean)
      });
      setResult({ contentId: r.contentId, latencyMs: r.latencyMs });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingest failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ingest a title"
        subtitle="Gemini enriches summary + tags + positioning, then persists via mcp-clickhouse"
      />
      <Card>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Title
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} required />
          </label>
          <label>
            Description
            <textarea className="input" rows={4} value={description} onChange={e => setDescription(e.target.value)} required />
          </label>
          <label>
            Genre
            <select className="input" value={genre} onChange={e => setGenre(e.target.value)}>
              {['Sci-Fi', 'Drama', 'Comedy', 'Horror', 'Romance', 'Action', 'Thriller', 'Documentary', 'Animation'].map(g => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label>
            Release date
            <input className="input" type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} required />
          </label>
          <label>
            Cast (comma-separated)
            <input className="input" value={cast} onChange={e => setCast(e.target.value)} placeholder="Actor One, Actor Two" />
          </label>
          <button className="btn primary" type="submit" disabled={submitting}>
            {submitting ? 'Enriching & storing…' : 'Ingest via agent pipeline'}
          </button>
        </form>
        {error && <ErrorBanner message={error} />}
        {result && (
          <div className="success">
            Stored <code>{result.contentId}</code> in {result.latencyMs}ms via MCP INSERT
          </div>
        )}
      </Card>
    </>
  );
}
