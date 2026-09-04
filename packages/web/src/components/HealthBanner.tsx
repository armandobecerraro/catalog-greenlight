import { MAX_ATTEMPTS, useHealthPoll } from '../hooks/useHealthPoll';
import { useLocale } from '../i18n/LocaleContext';

export function HealthBanner() {
  const { t } = useLocale();
  const { health, waking, retry, attempt, maxAttempts, elapsedHint } = useHealthPoll();
  const progressPct = maxAttempts > 0 ? Math.min(100, Math.round((attempt / maxAttempts) * 100)) : 0;
  const elapsedSeconds = Math.round(elapsedHint / 1000);

  if (!waking && health?.ready) return null;

  return (
    <div className="health-banner" role="status" aria-live="polite">
      <div className="health-banner-inner">
        <p className="health-banner-title">{t('health.wakingTitle')}</p>
        <p className="health-banner-body muted">{t('health.wakingBody')}</p>
        <p className="health-banner-eta muted small">{t('health.wakingEta')}</p>
        <div
          className="health-banner-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={maxAttempts}
          aria-valuenow={attempt}
          aria-label={t('health.progressLabel', { attempt, max: maxAttempts })}
        >
          <div className="health-banner-progress-track">
            <div className="health-banner-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="health-banner-progress-meta small muted">
            {t('health.progress', { attempt, max: maxAttempts })}
            {elapsedSeconds > 0 && ` · ${t('health.elapsed', { seconds: elapsedSeconds })}`}
          </p>
        </div>
        {health?.error && <p className="health-banner-meta small">{health.error}</p>}
        {attempt >= MAX_ATTEMPTS && !health?.ready && (
          <p className="health-banner-meta small muted">{t('health.maxAttempts')}</p>
        )}
        <button type="button" className="btn secondary health-banner-retry" onClick={retry}>
          {t('health.retry')}
        </button>
      </div>
    </div>
  );
}
