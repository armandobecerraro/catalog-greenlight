import { FormEvent, useState } from 'react';
import { api, AgentRunResult } from '../api';
import { PageHeader, Card, ErrorBanner, AgentTimeline } from '../components/Layout';

const SUGGESTIONS = [
  'Which genre is under-represented in our catalog?',
  'Recommend 3 titles for a late-night sci-fi slot',
  'What titles had the highest revenue last week?'
];

export default function Ask() {
  const [question, setQuestion] = useState(SUGGESTIONS[0]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.ask(question);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Ask the catalog"
        subtitle="Natural language → INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT"
      />
      <Card>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Your question
            <textarea className="input" rows={3} value={question} onChange={e => setQuestion(e.target.value)} />
          </label>
          <div className="chips">
            {SUGGESTIONS.map(s => (
              <button key={s} type="button" className="chip" onClick={() => setQuestion(s)}>
                {s}
              </button>
            ))}
          </div>
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? 'Agent running…' : 'Run agent'}
          </button>
        </form>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <h3>Answer</h3>
            <p className="answer">{result.answer}</p>
            <p className="muted">
              Intent: {result.intent} · {result.totalLatencyMs}ms · model {result.model}
            </p>
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="rec-grid">
                {result.recommendations.map((r, i) => (
                  <article key={i} className="rec-card">
                    <h4>{r.title}</h4>
                    <span className="genre-pill">{r.genre}</span>
                    <p>{r.justification}</p>
                    <p className="evidence">{r.evidence}</p>
                  </article>
                ))}
              </div>
            )}
          </Card>

          {result.sql && (
            <Card>
              <h3>SQL executed (MCP run_query)</h3>
              <pre className="sql-block">{result.sql}</pre>
            </Card>
          )}

          {result.queryRows && result.queryRows.length > 0 && (
            <Card>
              <h3>Evidence ({result.queryRows.length} rows)</h3>
              <pre className="sql-block">{JSON.stringify(result.queryRows.slice(0, 20), null, 2)}</pre>
            </Card>
          )}

          <Card>
            <h3>Agent timeline</h3>
            <AgentTimeline steps={result.steps} />
          </Card>
        </>
      )}
    </>
  );
}
