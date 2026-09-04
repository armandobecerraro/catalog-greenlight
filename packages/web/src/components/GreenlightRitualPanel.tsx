import type { AgentRunResult } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import { formatPct, metricsForRec, isSeedFillerTitle } from '../utils/greenlightMetrics';

export function GreenlightRitualPanel({ greenlight }: { greenlight: AgentRunResult }) {
  const { t } = useLocale();
  const recommendations = (greenlight.recommendations ?? []).filter(r => r.title?.trim());
  const queryRows = (greenlight.queryRows ?? []) as Record<string, unknown>[];

  if (recommendations.length === 0) return null;

  return (
    <section className="ritual-panel" aria-label={t('dashboard.ritualTitle')}>
      <div className="ritual-head">
        <div>
          <h4>{t('dashboard.ritualTitle')}</h4>
          <p className="muted ritual-sub">{t('dashboard.ritualSubtitle')}</p>
        </div>
      </div>

      <div className="table-wrap">
        <table className="greenlight-slate-table">
          <thead>
            <tr>
              <th>{t('dashboard.colRank')}</th>
              <th>{t('dashboard.colTitle')}</th>
              <th>{t('dashboard.colGenre')}</th>
              <th>{t('dashboard.metricScore')}</th>
              <th>{t('dashboard.metricWow')}</th>
              <th>{t('dashboard.metricGenreGap')}</th>
              <th>{t('dashboard.metricCannibal')}</th>
              <th>{t('dashboard.colEvidence')}</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec, i) => {
              const metrics = metricsForRec(rec, queryRows);
              return (
                <tr key={i} className="greenlight-slate-row" data-title={rec.title}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{rec.title}</strong>
                    {isSeedFillerTitle(rec.title) && (
                      <span className="badge filler-depth-badge slate-filler-badge">
                        catalog depth fill
                      </span>
                    )}
                    <p className="muted small slate-justification">{rec.justification}</p>
                  </td>
                  <td>
                    <span className="genre-pill">{rec.genre}</span>
                  </td>
                  <td className="num">{metrics.opportunity_score?.toFixed(3) ?? '—'}</td>
                  <td className="num">{formatPct(metrics.wow_pct)}</td>
                  <td className="num">{metrics.genre_gap?.toFixed(3) ?? '—'}</td>
                  <td>
                    {metrics.in_cannibal_pair
                      ? t('dashboard.metricYes')
                      : t('dashboard.metricNo')}
                  </td>
                  <td className="evidence-cell">{rec.evidence}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
