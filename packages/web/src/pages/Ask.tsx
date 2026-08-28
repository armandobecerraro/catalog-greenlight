import { FormEvent, useEffect, useState } from 'react';
import { api, AgentRunResult } from '../api';
import { PageHeader, Card, ErrorBanner, AgentTimeline } from '../components/Layout';
import { useLocale } from '../i18n/LocaleContext';
import { translations } from '../i18n/translations';

export default function Ask() {
  const { locale, t } = useLocale();
  const suggestions = translations[locale].ask.suggestions;
  const [question, setQuestion] = useState<string>(suggestions[0]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuestion(translations[locale].ask.suggestions[0]);
    setResult(null);
    setError('');
  }, [locale]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await api.ask(question);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('ask.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title={t('ask.title')} subtitle={t('ask.subtitle')} />
      <Card>
        <form className="form" onSubmit={onSubmit}>
          <label>
            {t('ask.labelQuestion')}
            <textarea className="input" rows={3} value={question} onChange={e => setQuestion(e.target.value)} />
          </label>
          <div className="chips">
            {suggestions.map(s => (
              <button key={s} type="button" className="chip" onClick={() => setQuestion(s)}>
                {s}
              </button>
            ))}
          </div>
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? t('ask.running') : t('ask.submit')}
          </button>
        </form>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <h3>{t('ask.answer')}</h3>
            <p className="answer">{result.answer}</p>
            <p className="muted">
              {t('ask.intent')}: {result.intent} · {result.totalLatencyMs}ms · model {result.model}
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
              <h3>{t('ask.sqlTitle')}</h3>
              <pre className="sql-block">{result.sql}</pre>
            </Card>
          )}

          {result.queryRows && result.queryRows.length > 0 && (
            <Card>
              <h3>{t('ask.evidenceTitle', { count: result.queryRows.length })}</h3>
              <pre className="sql-block">{JSON.stringify(result.queryRows.slice(0, 20), null, 2)}</pre>
            </Card>
          )}

          <Card>
            <h3>{t('ask.timelineTitle')}</h3>
            <AgentTimeline steps={result.steps} />
          </Card>
        </>
      )}
    </>
  );
}
