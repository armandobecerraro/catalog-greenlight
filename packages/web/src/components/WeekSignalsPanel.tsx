import { Link } from 'react-router-dom';
import type { AgentRunResult, CatalogStats } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { DEMO_STORY_GUIDE_ANCHOR } from './UserGuideContent';
import { buildWeekSignals } from '../utils/weekSignals';
import { Card } from './Layout';

export function WeekSignalsPanel({
  stats,
  greenlight,
  statsLoading,
  greenlightLoading
}: {
  stats: CatalogStats | null;
  greenlight: AgentRunResult | null;
  statsLoading: boolean;
  greenlightLoading: boolean;
}) {
  const { t } = useLocale();
  const { bullets, impact, partial } = buildWeekSignals(
    stats,
    greenlight,
    statsLoading,
    greenlightLoading,
    t
  );

  return (
    <Card className="signals-panel" aria-live="polite">
      <h3>{t('dashboard.signals.title')}</h3>
      <ul className="signals-list">
        {bullets.map((bullet, i) => (
          <li key={i} className={partial ? 'signals-item-partial' : undefined}>
            {bullet}
          </li>
        ))}
      </ul>
      <p className="signals-impact">{impact}</p>
      <p className="signals-footer">
        <Link to={`/guia#${DEMO_STORY_GUIDE_ANCHOR}`} className="signals-guide-link">
          {t('dashboard.signals.guideLink')} →
        </Link>
        {partial && <span className="muted">{t('dashboard.signals.measuring')}</span>}
      </p>
    </Card>
  );
}
