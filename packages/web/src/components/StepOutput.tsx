import { useState } from 'react';
import { useLocale } from '../i18n/LocaleContext';
import { DataTable } from './DataTable';

function SqlBlock({ sql }: { sql: string }) {
  return <pre className="sql-block">{sql}</pre>;
}

function Collapsible({
  label,
  defaultOpen = false,
  children
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="collapsible">
      <button type="button" className="collapsible-trigger" onClick={() => setOpen(v => !v)}>
        {open ? t('steps.hideDetails') : t('steps.showDetails')} — {label}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <p className="kv-line">
      <span className="kv-label">{label}:</span> {value}
    </p>
  );
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(r => r && typeof r === 'object') as Record<string, unknown>[];
}

export function StepOutput({ step, output }: { step: string; output: unknown }) {
  const { t } = useLocale();

  if (output == null) {
    return <p className="muted small">{t('steps.noOutput')}</p>;
  }

  if (typeof output === 'string') {
    return <p className="step-text">{output}</p>;
  }

  if (typeof output !== 'object') {
    return <p className="step-text">{String(output)}</p>;
  }

  const data = output as Record<string, unknown>;

  switch (step) {
    case 'INTENT':
      return (
        <div className="step-output">
          {typeof data.intent === 'string' && (
            <KeyValue label={t('steps.intentLabel')} value={data.intent} />
          )}
          {typeof data.source === 'string' && (
            <KeyValue label={t('steps.sourceLabel')} value={data.source} />
          )}
        </div>
      );

    case 'DISCOVER':
      if (typeof data.schema === 'string') {
        return (
          <Collapsible label={t('steps.schemaLabel')}>
            <SqlBlock sql={data.schema} />
          </Collapsible>
        );
      }
      if (Array.isArray(data.queries)) {
        return (
          <div className="step-output">
            {(data.queries as Array<Record<string, unknown>>).map((q, i) => (
              <div key={i} className="query-block">
                <div className="query-meta">
                  <strong>{String(q.id ?? t('steps.queryLabel'))}</strong>
                  {q.rowCount != null && (
                    <span className="meta-pill">{t('steps.rowCount', { count: Number(q.rowCount) })}</span>
                  )}
                  {q.latencyMs != null && (
                    <span className="meta-pill">{t('steps.latency', { ms: Number(q.latencyMs) })}</span>
                  )}
                </div>
                {typeof q.sql === 'string' && (
                  <Collapsible label={t('steps.sqlLabel')}>
                    <SqlBlock sql={q.sql} />
                  </Collapsible>
                )}
                {asRows(q.rows).length > 0 && (
                  <Collapsible label={t('steps.rowsLabel')}>
                    <DataTable rows={asRows(q.rows)} maxRows={10} />
                  </Collapsible>
                )}
              </div>
            ))}
          </div>
        );
      }
      break;

    case 'PLAN_SQL':
      if (Array.isArray(data.attempts)) {
        return (
          <div className="step-output">
            {(data.attempts as Array<Record<string, unknown>>).map((attempt, i) => (
              <div key={i} className="query-block">
                {typeof attempt.note === 'string' && <p className="muted small">{attempt.note}</p>}
                {typeof attempt.sql === 'string' && <SqlBlock sql={attempt.sql} />}
              </div>
            ))}
          </div>
        );
      }
      return (
        <div className="step-output">
          {typeof data.formula === 'string' && (
            <KeyValue label={t('steps.formulaLabel')} value={data.formula} />
          )}
          {data.candidateCount != null && (
            <KeyValue
              label={t('steps.candidateCountLabel')}
              value={String(data.candidateCount)}
            />
          )}
          {data.momentumRowsScored != null && (
            <KeyValue
              label={t('steps.momentumRowsLabel')}
              value={String(data.momentumRowsScored)}
            />
          )}
          {asRows(data.topCandidates).length > 0 && (
            <Collapsible label={t('steps.topCandidatesLabel')}>
              <DataTable rows={asRows(data.topCandidates)} maxRows={10} />
            </Collapsible>
          )}
        </div>
      );

    case 'EXECUTE':
      return (
        <div className="step-output">
          {Array.isArray(data.attempts) &&
            (data.attempts as Array<Record<string, unknown>>).map((attempt, i) => (
              <div key={i} className="query-block">
                <div className="query-meta">
                  <span className="meta-pill">
                    {t('steps.attemptLabel', { n: i + 1 })}
                  </span>
                  {attempt.rowCount != null && (
                    <span className="meta-pill">
                      {t('steps.rowCount', { count: Number(attempt.rowCount) })}
                    </span>
                  )}
                  {attempt.retry === true && (
                    <span className="meta-pill retry">{t('steps.retryLabel')}</span>
                  )}
                </div>
                {typeof attempt.error === 'string' && (
                  <p className="timeline-error">{attempt.error}</p>
                )}
                {typeof attempt.sql === 'string' && (
                  <Collapsible label={t('steps.sqlLabel')}>
                    <SqlBlock sql={attempt.sql} />
                  </Collapsible>
                )}
              </div>
            ))}
          {asRows(data.rows).length > 0 && (
            <Collapsible label={t('steps.rowsLabel')} defaultOpen>
              <DataTable rows={asRows(data.rows)} maxRows={15} />
            </Collapsible>
          )}
        </div>
      );

    case 'SYNTHESIZE':
      return (
        <div className="step-output">
          {typeof data.answer === 'string' && (
            <p className="step-text synthesize-answer">{data.answer}</p>
          )}
          {data.fallback === true && (
            <p className="muted small">{t('steps.fallbackLabel')}</p>
          )}
          {typeof data.geminiError === 'string' && (
            <p className="timeline-error">{data.geminiError}</p>
          )}
          {asRows(data.recommendations).length > 0 && (
            <Collapsible label={t('steps.recommendationsLabel')}>
              <DataTable rows={asRows(data.recommendations)} maxRows={5} />
            </Collapsible>
          )}
        </div>
      );

    case 'AUDIT':
      return (
        <div className="step-output">
          {typeof data.auditId === 'string' && (
            <KeyValue label={t('steps.auditIdLabel')} value={data.auditId} />
          )}
        </div>
      );
  }

  return (
    <Collapsible label={t('steps.rawOutputLabel')}>
      <pre className="timeline-output">{JSON.stringify(output, null, 2).slice(0, 2000)}</pre>
    </Collapsible>
  );
}
