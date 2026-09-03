import type { AgentRunResult, Recommendation } from '../api';
import { useLocale } from '../i18n/LocaleContext';
import {
  metricsForRec,
  SCORER_WEIGHTS,
  scorerFormulaText,
  formatPct,
  isSeedFillerTitle
} from '../utils/greenlightMetrics';
import { synthesizeStepError, usedScorerFallback } from '../utils/greenlightUx';

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
  queryRows
}: {
  rec: Recommendation;
  queryRows: Record<string, unknown>[];
}) {
  const { t } = useLocale();
  const fields = metricsForRec(rec, queryRows);
  const genreGap = fields.genre_gap ?? 0;
  const wowMomentum = fields.wow_momentum;
  const cannibalPenalty = fields.cannibalization_penalty || 0;
  const genreContrib = SCORER_WEIGHTS.genre_gap * genreGap;
  const wowContrib =
    wowMomentum != null ? SCORER_WEIGHTS.wow_momentum * wowMomentum : undefined;
  const cannibalContrib = -SCORER_WEIGHTS.cannibalization_penalty * cannibalPenalty;

  return (
    <div className="rec-provenance">
      <p className="provenance-heading">{t('greenlight.provenanceTitle')}</p>
      <ul className="provenance-list">
        <ProvenanceRow
          dimension="genre_gap"
          rawValue={formatNum(fields.genre_gap)}
          queryId="D_slate_holes"
          contribution={`+${formatNum(genreContrib)}`}
        />
        <ProvenanceRow
          dimension="wow_momentum"
          rawValue={
            wowMomentum != null
              ? `${formatNum(wowMomentum)} (wow_pct ${formatPctLocal(fields.wow_pct)})`
              : `wow_pct ${formatPctLocal(fields.wow_pct)}`
          }
          queryId="B_title_momentum"
          contribution={wowContrib != null ? `+${formatNum(wowContrib)}` : '—'}
        />
        <ProvenanceRow
          dimension="cannibalization_penalty"
          rawValue={String(cannibalPenalty)}
          queryId="C_cannibalization"
          contribution={formatNum(cannibalContrib)}
        />
      </ul>
    </div>
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
