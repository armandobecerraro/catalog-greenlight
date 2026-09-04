import { useState } from 'react';
import type { AgentRunResult } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { metricsForRec, SCORER_WEIGHTS } from '../utils/greenlightMetrics';
import {
  exportWeeklySlate,
  gapFilledFromRun,
  programmingMemo
} from '../utils/greenlightExport';

export type SlateReviewPhase = 'idle' | 'review' | 'confirmed';

export function SlateReviewFlow({ greenlight }: { greenlight: AgentRunResult }) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<SlateReviewPhase>('idle');
  const recs = (greenlight.recommendations ?? []).filter(r => r.title?.trim());
  if (recs.length === 0) return null;

  const memo = programmingMemo(greenlight);
  const gap = gapFilledFromRun(greenlight);
  const queryRows: Record<string, unknown>[] = Array.isArray(greenlight.queryRows)
    ? greenlight.queryRows
    : [];
  const excluded = greenlight.cannibalExcluded ?? [];

  function onConfirm(format: 'csv' | 'json') {
    exportWeeklySlate(greenlight, format);
    setPhase('confirmed');
  }

  return (
    <div className="slate-review-flow" role="region" aria-label={t('slateReview.title')}>
      {phase === 'idle' && (
        <div className="slate-bar">
          <p className="slate-attribution">{t('greenlight.clickhouseAttribution')}</p>
          <div className="slate-bar-actions">
            <span className="muted small slate-bar-label">{t('slateReview.idleHint')}</span>
            <button type="button" className="btn primary" onClick={() => setPhase('review')}>
              {t('slateReview.reviewCta')}
            </button>
          </div>
        </div>
      )}

      {phase === 'review' && (
        <section className="slate-review-panel">
          <h4>{t('slateReview.title')}</h4>
          <p className="muted small">{t('slateReview.picksTitle')}</p>
          <ol className="slate-review-picks">
            {recs.map((rec, i) => {
              const m = metricsForRec(rec, queryRows);
              return (
                <li key={`${rec.title}-${i}`}>
                  <strong>
                    {i + 1}. {rec.title}
                  </strong>
                  <span className="genre-pill">{rec.genre}</span>
                  <dl className="rec-metrics rec-metrics-compact">
                    <div>
                      <dt>score</dt>
                      <dd>{m.opportunity_score?.toFixed(3) ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>0.4×genre_gap</dt>
                      <dd>{((m.genre_gap ?? 0) * SCORER_WEIGHTS.genre_gap).toFixed(3)}</dd>
                    </div>
                    <div>
                      <dt>0.4×wow</dt>
                      <dd>
                        {m.wow_momentum != null
                          ? (m.wow_momentum * SCORER_WEIGHTS.wow_momentum).toFixed(3)
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>−0.2×cannibal</dt>
                      <dd>
                        {(-(m.cannibalization_penalty || 0) * SCORER_WEIGHTS.cannibalization_penalty).toFixed(3)}
                      </dd>
                    </div>
                    <div>
                      <dt>0.05×language_gap</dt>
                      <dd>{((m.language_gap ?? 0) * SCORER_WEIGHTS.language_gap).toFixed(3)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ol>
          <h5>{t('slateReview.cannibalTitle')}</h5>
          {excluded.length === 0 ? (
            <p className="muted">{t('cockpit.cannibalEmpty')}</p>
          ) : (
            <ul>
              {excluded.map((item, i) => (
                <li key={i}>
                  {item.title} — {t('cockpit.cannibalCopy')}
                </li>
              ))}
            </ul>
          )}
          <p>
            <strong>{t('slateReview.gapFilled')}: </strong>
            {gap.available ? gap.label : t('slateReview.gapUnavailable')}
          </p>
          <h5>{t('slateReview.memoLabel')}</h5>
          <pre className="slate-review-memo">{memo.text}</pre>
          {memo.source === 'template' && (
            <p className="muted small">{t('slateReview.memoFallback')}</p>
          )}
          <div className="slate-bar-actions">
            <button type="button" className="btn secondary" onClick={() => setPhase('idle')}>
              {t('slateReview.back')}
            </button>
            <button type="button" className="btn primary" onClick={() => onConfirm('csv')}>
              {t('slateReview.downloadCsv')}
            </button>
            <button type="button" className="btn secondary" onClick={() => onConfirm('json')}>
              {t('slateReview.downloadJson')}
            </button>
          </div>
        </section>
      )}

      {phase === 'confirmed' && (
        <div className="slate-bar">
          <p className="slate-attribution">{t('slateReview.confirmed')}</p>
          <div className="slate-bar-actions">
            <button type="button" className="btn secondary" onClick={() => setPhase('review')}>
              {t('slateReview.reviewCta')}
            </button>
            <button type="button" className="btn primary" onClick={() => onConfirm('csv')}>
              {t('slateReview.downloadCsv')}
            </button>
            <button type="button" className="btn secondary" onClick={() => onConfirm('json')}>
              {t('slateReview.downloadJson')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
