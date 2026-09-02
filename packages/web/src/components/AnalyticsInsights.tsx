import { useLocale } from '../i18n/LocaleContext';
import { Card } from './Layout';
import { GreenlightAnalytics } from '../utils/greenlightAnalytics';

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function barWidth(value: number, max: number): string {
  return `${Math.min(100, Math.max(4, (Math.abs(value) / max) * 100)).toFixed(1)}%`;
}

interface Props {
  analytics: GreenlightAnalytics;
}

export default function AnalyticsInsights({ analytics }: Props) {
  const { t } = useLocale();
  const maxGap = Math.max(...analytics.genreGaps.map(g => g.gapScore), 0.01);
  const maxWow = Math.max(...analytics.momentumHighlights.map(m => Math.abs(m.wowPct)), 0.01);

  return (
    <section className="analytics-section" aria-label={t('dashboard.analyticsTitle')}>
      <h3 className="analytics-heading">{t('dashboard.analyticsTitle')}</h3>
      <p className="muted small analytics-sub">{t('dashboard.analyticsSub')}</p>

      <div className="analytics-grid">
        <Card className="analytics-card">
          <h4>{t('dashboard.analyticsGenreTitle')}</h4>
          <p className="muted small">{t('dashboard.analyticsGenreHint')}</p>
          {analytics.genreGaps.length === 0 ? (
            <p className="muted small">{t('dashboard.analyticsNoData')}</p>
          ) : (
            <ul className="bar-list">
              {analytics.genreGaps.slice(0, 6).map(row => (
                <li key={row.genre} className="bar-row">
                  <div className="bar-label">
                    <span>{row.genre}</span>
                    <span className="bar-value">{pct(row.gapScore)}</span>
                  </div>
                  <div className="bar-track">
                    <span
                      className="bar-fill bar-fill-gap"
                      style={{ width: barWidth(row.gapScore, maxGap) }}
                      title={t('dashboard.analyticsGenreTooltip', {
                        titles: pct(row.titleShare),
                        revenue: pct(row.revenueShare)
                      })}
                    />
                  </div>
                  <p className="bar-meta muted small">
                    {t('dashboard.analyticsGenreMeta', {
                      count: row.titleCount,
                      titles: pct(row.titleShare),
                      revenue: pct(row.revenueShare)
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="analytics-card">
          <h4>{t('dashboard.analyticsMomentumTitle')}</h4>
          <p className="muted small">{t('dashboard.analyticsMomentumHint')}</p>
          {analytics.momentumHighlights.length === 0 ? (
            <p className="muted small">{t('dashboard.analyticsMomentumEmpty')}</p>
          ) : (
            <ul className="bar-list">
              {analytics.momentumHighlights.map(row => (
                <li key={row.title} className="bar-row">
                  <div className="bar-label">
                    <span className="bar-title">{row.title}</span>
                    <span className={`bar-value ${row.wowPct >= 0 ? 'positive' : 'negative'}`}>
                      {pct(row.wowPct)}
                    </span>
                  </div>
                  <div className="bar-track">
                    <span
                      className={`bar-fill ${row.wowPct >= 0 ? 'bar-fill-wow-up' : 'bar-fill-wow-down'}`}
                      style={{ width: barWidth(row.wowPct, maxWow) }}
                    />
                  </div>
                  <p className="bar-meta muted small">{row.genre}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={`analytics-card ${analytics.cannibalPairs.length > 0 ? 'analytics-warn' : ''}`}>
          <h4>{t('dashboard.analyticsCannibalTitle')}</h4>
          <p className="muted small">{t('dashboard.analyticsCannibalHint')}</p>
          {analytics.cannibalPairs.length === 0 ? (
            <p className="muted small">{t('dashboard.analyticsCannibalClear')}</p>
          ) : (
            <>
              <p className="analytics-warn-banner">{t('dashboard.analyticsCannibalWarn')}</p>
              <div className="table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.analyticsColTitleA')}</th>
                      <th>{t('dashboard.analyticsColTitleB')}</th>
                      <th>{t('dashboard.analyticsColGenre')}</th>
                      <th>{t('dashboard.analyticsColRevenue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.cannibalPairs.map((pair, i) => (
                      <tr key={`${pair.titleA}-${pair.titleB}-${i}`}>
                        <td>{pair.titleA}</td>
                        <td>{pair.titleB}</td>
                        <td>{pair.genre}</td>
                        <td>
                          ${pair.revenueA.toFixed(0)} / ${pair.revenueB.toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}
