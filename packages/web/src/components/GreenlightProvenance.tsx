import type { AgentRunResult, CannibalExcluded, Recommendation, RunnerUp } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import {
  metricsForRec,
  SCORER_WEIGHTS,
  SCORE_FROM_QUERIES,
  scorerFormulaText,
  formatPct,
  isSeedFillerTitle
} from '../utils/greenlightMetrics';
import {
  greenlightGeminiMs,
  greenlightGeminiStatus,
  greenlightMcpMs,
  synthesizeStepError,
  usedScorerFallback
} from '../utils/greenlightUx';

export const MCP_QUERY_IDS = [
  'A_genre_inventory',
  'B_title_momentum',
  'C_cannibalization',
  'D_slate_holes'
] as const;

export function GreenlightStackBadge() {
  const { t } = useLocale();
  return <span className="badge provenance-stack">{t('greenlight.stackBadge')}</span>;
}

export function ScorerFormulaBar() {
  const { t } = useLocale();
  return (
    <div className="scorer-formula-bar" aria-label={t('greenlight.formulaTitle')}>
      <span className="scorer-formula-label">{t('greenlight.formulaTitle')}</span>
      <code className="scorer-formula-text">{scorerFormulaText()}</code>
    </div>
  );
}

export function SynthesizeFallbackBadge({ greenlight }: { greenlight: AgentRunResult }) {
  const { t } = useLocale();
  if (!usedScorerFallback(greenlight)) return null;
  const detail = synthesizeStepError(greenlight);
  return (
    <span className="badge fallback-badge" title={detail ?? undefined}>
      {t('greenlight.fallbackBadge')}
    </span>
  );
}

function formatNum(value: number | undefined, digits = 3): string {
  if (value == null) return '—';
  return value.toFixed(digits);
}

/** Compact measured-fields strip for first-viewport judges (<60s). */
export function RecProvenanceStrip({
  rec,
  queryRows
}: {
  rec: Recommendation;
  queryRows: Record<string, unknown>[];
}) {
  const { t } = useLocale();
  const fields = metricsForRec(rec, queryRows);

  return (
    <div className="rec-provenance-strip" aria-label={t('greenlight.stripAria')}>
      <span className="strip-chip" title={t('dashboard.metricScore')}>
        <span className="strip-label">score</span>
        <strong>{formatNum(fields.opportunity_score)}</strong>
      </span>
      <span className="strip-chip" title={t('dashboard.metricGenreGap')}>
        <span className="strip-label">genre_gap</span>
        <strong>{formatNum(fields.genre_gap)}</strong>
      </span>
      <span className="strip-chip" title={t('dashboard.metricWow')}>
        <span className="strip-label">wow_pct</span>
        <strong>{formatPct(fields.wow_pct)}</strong>
      </span>
      <span className="strip-chip" title={t('dashboard.metricCannibal')}>
        <span className="strip-label">cannibal</span>
        <strong>
          {fields.in_cannibal_pair ? t('dashboard.metricYes') : t('dashboard.metricNo')}
        </strong>
      </span>
      <span className="strip-mcp" title={t('greenlight.stripMcpTitle')}>
        MCP: {MCP_QUERY_IDS.join(' · ')}
      </span>
    </div>
  );
}

export function FillerDepthBadge({ title }: { title: string }) {
  const { t } = useLocale();
  if (!isSeedFillerTitle(title)) return null;
  return (
    <span className="badge filler-depth-badge" title={t('greenlight.fillerHint')}>
      {t('greenlight.fillerBadge')}
    </span>
  );
}

function formatPctLocal(value: number | undefined): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function ProvenanceRow({
  dimension,
  rawValue,
  queryId,
  contribution
}: {
  dimension: string;
  rawValue: string;
  queryId: string;
  contribution: string;
}) {
  const { t } = useLocale();
  return (
    <li className="provenance-row">
      <span className="prov-dimension">{dimension}</span>
      <span className="prov-value">{rawValue}</span>
      <span className="prov-query">{t('greenlight.fromQuery', { query: queryId })}</span>
      <span className="prov-contrib">{contribution}</span>
    </li>
  );
}

export function RecProvenance({
  rec,
  queryRows,
  runnerUp
}: {
  rec: Recommendation;
  queryRows: Record<string, unknown>[];
  runnerUp?: RunnerUp;
}) {
  const { t } = useLocale();
  const fields = metricsForRec(rec, queryRows);
  const genreGap = fields.genre_gap ?? 0;
  const wowMomentum = fields.wow_momentum;
  const cannibalPenalty = fields.cannibalization_penalty || 0;
  const languageGap = fields.language_gap ?? 0;
  const genreContrib = SCORER_WEIGHTS.genre_gap * genreGap;
  const wowContrib =
    wowMomentum != null ? SCORER_WEIGHTS.wow_momentum * wowMomentum : undefined;
  const cannibalContrib = -SCORER_WEIGHTS.cannibalization_penalty * cannibalPenalty;
  const languageContrib = SCORER_WEIGHTS.language_gap * languageGap;
  const whyKey =
    runnerUp?.whyLost === 'diversity'
      ? 'cockpit.whyLostDiversity'
      : runnerUp?.whyLost === 'cannibal'
        ? 'cockpit.whyLostCannibal'
        : 'cockpit.whyLostLower';

  return (
    <div className="rec-provenance">
      <p className="provenance-heading">{t('greenlight.provenanceTitle')}</p>
      <ul className="provenance-list">
        <ProvenanceRow
          dimension="genre_gap"
          rawValue={formatNum(fields.genre_gap)}
          queryId={SCORE_FROM_QUERIES.genre_gap}
          contribution={`+${formatNum(genreContrib)}`}
        />
        <ProvenanceRow
          dimension="wow_momentum"
          rawValue={
            wowMomentum != null
              ? `${formatNum(wowMomentum)} (wow_pct ${formatPctLocal(fields.wow_pct)})`
              : `wow_pct ${formatPctLocal(fields.wow_pct)}`
          }
          queryId={SCORE_FROM_QUERIES.wow_momentum}
          contribution={wowContrib != null ? `+${formatNum(wowContrib)}` : '—'}
        />
        <ProvenanceRow
          dimension="cannibalization_penalty"
          rawValue={String(cannibalPenalty)}
          queryId={SCORE_FROM_QUERIES.cannibalization_penalty}
          contribution={formatNum(cannibalContrib)}
        />
        <ProvenanceRow
          dimension="language_gap"
          rawValue={formatNum(fields.language_gap)}
          queryId={SCORE_FROM_QUERIES.language_gap}
          contribution={`+${formatNum(languageContrib)}`}
        />
      </ul>
      {runnerUp && (
        <p className="provenance-runner-up">
          {t('cockpit.beatRunnerUp', {
            title: runnerUp.title,
            score: runnerUp.opportunity_score.toFixed(3),
            why: t(whyKey)
          })}
        </p>
      )}
    </div>
  );
}

export function DecisionCockpitStrip({ greenlight }: { greenlight: AgentRunResult }) {
  const { t } = useLocale();
  const status = greenlightGeminiStatus(greenlight);
  const mcpMs = greenlightMcpMs(greenlight);
  const geminiMs = greenlightGeminiMs(greenlight);
  const geminiFailed = status === 'skipped' || status === 'error';
  const geminiLabel =
    status === 'error'
      ? t('cockpit.geminiError')
      : status === 'skipped'
        ? t('cockpit.geminiSkipped')
        : t('cockpit.geminiExplained');

  return (
    <div className="decision-cockpit-strip" role="region" aria-label={t('cockpit.stripAria')}>
      <p className="cockpit-status">
        <span>{t('cockpit.statusMeasured')}</span>
        <span aria-hidden="true"> · </span>
        <span>{t('cockpit.statusRanked')}</span>
        <span aria-hidden="true"> · </span>
        <span className="cockpit-gemini">
          <span className="cockpit-gemini-icon" aria-hidden="true">
            {geminiFailed ? '⚠' : '✓'}
          </span>
          {geminiLabel}
        </span>
      </p>
      <p className="cockpit-timings muted small">
        {mcpMs != null && <span>{t('cockpit.mcpMs', { ms: mcpMs })}</span>}
        {mcpMs != null && geminiMs != null && <span aria-hidden="true"> · </span>}
        {geminiMs != null && <span>{t('cockpit.geminiMs', { ms: geminiMs })}</span>}
      </p>
      {geminiFailed && (
        <p className="cockpit-ranking-stands">
          <span className="cockpit-gemini-icon" aria-hidden="true">
            ℹ
          </span>
          {t('cockpit.rankingStands')}
        </p>
      )}
      <p className="cockpit-job-line">{t('cockpit.jobLine')}</p>
      <SynthesizeFallbackBadge greenlight={greenlight} />
    </div>
  );
}

export function CannibalConflictPanel({
  exclusions
}: {
  exclusions: CannibalExcluded[] | undefined;
}) {
  const { t } = useLocale();
  const items = exclusions ?? [];

  return (
    <section className="cannibal-conflict-panel" aria-label={t('cockpit.cannibalTitle')}>
      <h4>{t('cockpit.cannibalTitle')}</h4>
      {items.length === 0 ? (
        <p className="muted">{t('cockpit.cannibalEmpty')}</p>
      ) : (
        <ul className="cannibal-conflict-list">
          {items.map((item, i) => (
            <li key={`${item.title}-${i}`}>
              <strong>{item.title}</strong>
              <span className="genre-pill">{item.genre}</span>
              <span className="muted small">score {item.opportunity_score.toFixed(3)}</span>
              <p>
                {item.pair.title_a} / {item.pair.title_b} ({item.pair.genre}). {t('cockpit.cannibalCopy')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GreenlightProvenanceHeader({ greenlight }: { greenlight: AgentRunResult }) {
  return (
    <div className="greenlight-provenance-header">
      <div className="provenance-badges">
        <GreenlightStackBadge />
        <SynthesizeFallbackBadge greenlight={greenlight} />
      </div>
      <ScorerFormulaBar />
    </div>
  );
}
