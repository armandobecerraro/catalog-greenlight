import type { AgentRunResult } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { exportWeeklySlate } from '../utils/greenlightExport';

export function GreenlightSlateBar({ greenlight }: { greenlight: AgentRunResult }) {
  const { t } = useLocale();
  const hasSlate = (greenlight.recommendations ?? []).some(r => r.title?.trim());
  if (!hasSlate) return null;

  return (
    <div className="slate-bar" role="region" aria-label={t('dashboard.ritualTitle')}>
      <p className="slate-attribution">{t('greenlight.clickhouseAttribution')}</p>
      <div className="slate-bar-actions">
        <span className="muted small slate-bar-label">{t('dashboard.ritualSubtitle')}</span>
        <button
          type="button"
          className="btn primary"
          onClick={() => exportWeeklySlate(greenlight, 'csv')}
        >
          {t('dashboard.exportCsv')}
        </button>
        <button
          type="button"
          className="btn secondary"
          onClick={() => exportWeeklySlate(greenlight, 'json')}
        >
          {t('dashboard.exportJson')}
        </button>
      </div>
    </div>
  );
}
