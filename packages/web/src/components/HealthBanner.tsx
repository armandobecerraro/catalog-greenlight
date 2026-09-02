import { useHealthPoll } from '../hooks/useHealthPoll';
import { useLocale } from '../i18n/LocaleContext';

export function HealthBanner() {
  const { t } = useLocale();
  const { health, waking, retry } = useHealthPoll();

  if (!waking && health?.ready) return null;

  return (
    <div className="health-banner" role="status" aria-live="polite">
      <div className="health-banner-inner">
        <p className="health-banner-title">{t('health.wakingTitle')}</p>
        <p className="health-banner-body muted">{t('health.wakingBody')}</p>
        {health?.error && <p className="health-banner-meta small">{health.error}</p>}
        <button type="button" className="btn secondary health-banner-retry" onClick={retry}>
          {t('health.retry')}
        </button>
      </div>
    </div>
  );
}
