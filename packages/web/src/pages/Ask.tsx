import { FormEvent, useEffect, useState } from 'react';
import { api, AgentRunResult } from '../api';
import { PageHeader, Card, ErrorBanner, Link } from '../components/Layout';
import { AgentTimeline } from '../components/AgentTimeline';
import { DataTable } from '../components/DataTable';
import { GreenlightProvenanceHeader, RecProvenance } from '../components/GreenlightProvenance';
import { useLocale } from '../i18n/LocaleContext';
import { translations } from '../i18n/translations';
import { formatApiError, ApiError } from '../utils/apiErrors';
import { filterRecommendations } from '../utils/recommendationGuards';
import { ASK_PROGRESS_STEPS, askStepFromElapsed, askStepStatus } from '../utils/askProgress';
import { gapScoreHighlight, hasClickHouseEvidence } from '../utils/askEvidence';

export default function Ask() {
  const { locale, t } = useLocale();
  const suggestions = translations[locale].ask.suggestions;
  const [question, setQuestion] = useState<string>(suggestions[0]);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState('');
  const [billingHint, setBillingHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setQuestion(translations[locale].ask.suggestions[0]);
    setResult(null);
    setError('');
    setBillingHint(false);
  }, [locale]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - started), 250);
    return () => window.clearInterval(id);
  }, [loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBillingHint(false);
    setResult(null);
    try {
      const r = await api.ask(question);
      setResult(r);
    } catch (err) {
      setError(formatApiError(t, err, 'ask.error'));
      setBillingHint(err instanceof ApiError && err.code === 'gemini_billing');
    } finally {
      setLoading(false);
    }
  }

  const groundedRecs = result ? filterRecommendations(result.recommendations) : [];
  const droppedRecCount =
    result?.recommendations != null ? result.recommendations.length - groundedRecs.length : 0;
  const measured = result ? hasClickHouseEvidence(result) : false;
  const gapHighlight = result ? gapScoreHighlight(result) : null;

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

      {loading && <AskProgress elapsed={elapsed} />}

      {error && <ErrorBanner message={error} />}
      {billingHint && (
        <p className="muted small">
          {t('ask.billingHint')} <Link to="/">{t('ask.billingHintCta')}</Link>
        </p>
      )}

      {result && (
        <>
          {measured ? (
            <div className="grounded-badge" role="status">
              {t('ask.groundedBadge')}
            </div>
          ) : result.fallback ? (
            <div className="fallback-badge" role="status">
              {t('ask.fallbackBadge')}
            </div>
          ) : null}

          <Card className="ask-answer-card">
            <h3>{t('ask.answer')}</h3>
            {gapHighlight && (
              <p className="ask-gap-highlight" data-testid="ask-gap-highlight">
                {gapHighlight}
              </p>
            )}
            <p className="answer">{result.answer}</p>
            <p className="muted">
              {t('ask.intent')}: {result.intent} · {result.totalLatencyMs}ms · model {result.model}
            </p>
            {result.fallback && measured && (
              <p className="muted small">{t('ask.fallbackNotice')}</p>
            )}
          </Card>

          {result.queryRows && result.queryRows.length > 0 && (
            <Card>
              <h3>{t('ask.evidenceTitle', { count: result.queryRows.length })}</h3>
              <DataTable rows={result.queryRows as Record<string, unknown>[]} maxRows={20} />
            </Card>
          )}

          {result.sql && (
            <details className="ask-sql-details">
              <summary>{t('ask.sqlTitle')}</summary>
              <pre className="sql-block">{result.sql}</pre>
            </details>
          )}

          <Card>
            <h3>{t('ask.timelineTitle')}</h3>
            <AgentTimeline steps={result.steps} />
          </Card>

          {groundedRecs.length > 0 && (
            <Card>
              {result.intent === 'greenlight' && (
                <GreenlightProvenanceHeader greenlight={result} />
              )}
              <div className="rec-grid">
                {groundedRecs.map((r, i) => (
                  <article key={i} className="rec-card">
                    <h4>{r.title}</h4>
                    <span className="genre-pill">{r.genre}</span>
                    {result.intent === 'greenlight' && (
                      <RecProvenance
                        rec={r}
                        queryRows={(result.queryRows ?? []) as Record<string, unknown>[]}
                      />
                    )}
                    {r.justification && <p>{r.justification}</p>}
                    {r.evidence && (
                      <p className="evidence">
                        {t('common.evidence')}: {r.evidence}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </Card>
          )}

          {result.recommendations &&
            result.recommendations.length > 0 &&
            groundedRecs.length === 0 &&
            result.intent !== 'greenlight' && (
              <Card>
                <p className="muted">{t('ask.ungroundedRecs')}</p>
              </Card>
            )}

          {droppedRecCount > 0 && (
            <p className="muted small ask-filter-note">{t('ask.filteredRecs', { count: droppedRecCount })}</p>
          )}
        </>
      )}
    </>
  );
}

function AskProgress({ elapsed }: { elapsed: number }) {
  const { t } = useLocale();
  const current = askStepFromElapsed(elapsed);
  const seconds = Math.floor(elapsed / 1000);
  const progressPct = Math.min(95, Math.round((elapsed / 45_000) * 100));

  return (
    <Card className="ask-progress-card">
      <div className="greenlight-progress ask-progress" role="status" aria-live="polite">
        <p className="greenlight-progress-lead">{t(`steps.${current}`)}</p>
        <p className="ask-progress-elapsed">{t('ask.progressElapsed', { seconds: String(seconds) })}</p>
        <div className="ask-progress-bar" aria-hidden="true">
          <div className="ask-progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <ol className="greenlight-progress-steps">
          {ASK_PROGRESS_STEPS.map(step => {
            const status = askStepStatus(step, current);
            return (
              <li key={step} className={`greenlight-progress-step is-${status}`}>
                <span className="greenlight-progress-dot" aria-hidden="true" />
                <span>{t(`steps.${step}`)}</span>
              </li>
            );
          })}
        </ol>
        <p className="muted greenlight-progress-hint">{t('ask.progressHint')}</p>
      </div>
    </Card>
  );
}
