import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, AgentRunResult, HealthStatus } from "../api";
import { PageHeader, Card } from "../components/Layout";
import { TrustStrip } from "../components/TrustStrip";
import {
  FillerDepthBadge,
  RecProvenanceStrip,
} from "../components/GreenlightProvenance";
import { GreenlightSlateBar } from "../components/GreenlightSlateBar";
import { useLocale } from "../i18n/LocaleContext";
import { downloadJuryEvidence, juryEvidencePayload } from "../utils/juryEvidence";
import { metricsForRec } from "../utils/greenlightMetrics";

const HEALTH_JSON = "/api/v1/health";
const GREENLIGHT_REFRESH = "/api/v1/greenlight?refresh=1";
const SCORER_GITHUB =
  "https://github.com/armandobecerraro/catalog-greenlight/blob/main/packages/orchestration/src/greenlight/GreenlightScorer.ts";

/** Published C_cannibalization (aggregates + windows) — fallback when the live run has no SQL. */
const PUBLISHED_CANNIBAL_SQL = `-- C_cannibalization: same-genre near-duplicates in the top revenue quartile
-- ClickHouse: quantile(0.75) threshold + title containment / prefix match
WITH latest AS (
  SELECT max(week_start) AS w FROM media_catalog.title_revenue
),
title_rev AS (
  SELECT tr.title_id, any(tr.title) AS title, mc.genre AS genre,
         sum(tr.revenue_usd) AS revenue_this_week
  FROM media_catalog.title_revenue AS tr
  INNER JOIN media_catalog.media_content AS mc ON mc.id = tr.title_id
  CROSS JOIN latest
  WHERE tr.week_start = latest.w
  GROUP BY tr.title_id, mc.genre
),
threshold AS (
  SELECT quantile(0.75)(revenue_this_week) AS q75 FROM title_rev
)
SELECT a.title AS title_a, b.title AS title_b, a.genre AS genre
FROM title_rev AS a
INNER JOIN title_rev AS b ON a.genre = b.genre AND a.title_id < b.title_id
CROSS JOIN threshold
WHERE a.revenue_this_week >= threshold.q75
  AND b.revenue_this_week >= threshold.q75
  AND (
    positionCaseInsensitiveUTF8(a.title, b.title) > 0
    OR positionCaseInsensitiveUTF8(b.title, a.title) > 0
    OR leftUTF8(lowerUTF8(a.title), 18) = leftUTF8(lowerUTF8(b.title), 18)
  )
LIMIT 40`;

function liveMcpSql(run: AgentRunResult | null, queryId: string): string | null {
  const discover = run?.steps?.find((s) => s.step === "DISCOVER");
  const queries = (discover?.output as { queries?: Array<{ id: string; sql?: string }> } | undefined)
    ?.queries;
  const sql = queries?.find((q) => q.id === queryId)?.sql;
  return sql && sql.trim() ? sql : null;
}

export default function Judge() {
  const { t, setLocale } = useLocale();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthFailed, setHealthFailed] = useState(false);
  const [greenlight, setGreenlight] = useState<AgentRunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    setLocale("en");
  }, [setLocale]);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setHealthFailed(false);
      })
      .catch(() => {
        setHealthFailed(true);
        setHealth(null);
      });
    api
      .getGreenlight()
      .then(setGreenlight)
      .catch(() => setGreenlight(null));
  }, []);

  async function onCopyEvidence() {
    const payload = juryEvidencePayload(greenlight);
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
      setCopied(false);
    }
  }

  function onDownloadEvidence() {
    if (downloadJuryEvidence(greenlight)) {
      setDownloaded(true);
    }
  }

  const waking = healthFailed || health == null || !health.ready;
  const recommendations = (greenlight?.recommendations ?? []).filter((r) => r.title?.trim());
  const queryRows = (greenlight?.queryRows ?? []) as Record<string, unknown>[];
  const cannibalSql = liveMcpSql(greenlight, "C_cannibalization") ?? PUBLISHED_CANNIBAL_SQL;

  return (
    <div className="judge-page">
      <PageHeader title={t("judge.title")} subtitle={t("judge.subtitle")} />

      <p className="judge-pitch" role="doc-subtitle">
        {t("judge.pitch")}
      </p>
      <p className="muted">{t("judge.icp")}</p>

      {waking && (
        <p className="judge-wake muted" role="status">
          {t("judge.coldStart")}
        </p>
      )}

      <TrustStrip health={health} />

      <Card className="judge-track-fit">
        <h3>{t("judge.trackFitTitle")}</h3>
        <ul className="judge-wedge-list">
          <li>{t("judge.trackFit1")}</li>
          <li>{t("judge.trackFit2")}</li>
          <li>{t("judge.trackFit3")}</li>
          <li>{t("judge.trackFit4")}</li>
          <li>{t("judge.trackFit5")}</li>
        </ul>
      </Card>

      <Card className="judge-job-table">
        <h3>{t("judge.jobTableTitle")}</h3>
        <table className="judge-benchmarks-table">
          <tbody>
            <tr>
              <td>Chloe Greenlight</td>
              <td>{t("judge.jobChloe")}</td>
            </tr>
            <tr>
              <td>Catalog Greenlight</td>
              <td>{t("judge.jobUs")}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <Card className="judge-wedge">
        <h3>{t("judge.wedgeTitle")}</h3>
        <ul className="judge-wedge-list">
          <li>
            <strong>vs Chloe Greenlight</strong> — {t("judge.vsChloe")}
          </li>
          <li>
            <strong>vs Flashframe</strong> — {t("judge.vsFlashframe")}
          </li>
        </ul>
      </Card>

      <Card className="judge-remove">
        <h3>{t("judge.removeTitle")}</h3>
        <p>{t("judge.removeBody")}</p>
        <ul>
          <li>
            <code>A_genre_inventory</code> — {t("judge.qInventory")}
          </li>
          <li>
            <code>B_title_momentum</code> — {t("judge.qMomentum")}
          </li>
          <li>
            <code>C_cannibalization</code> — {t("judge.qCannibal")}
          </li>
          <li>
            <code>D_slate_holes</code> — {t("judge.qHoles")}
          </li>
        </ul>
        <p className="muted small">
          {t("judge.codePointers")}: <code>McpClickHouseConnector.ts</code>,{" "}
          <code>GreenlightScorer.ts</code>, <code>AgentRunner.ts</code>
        </p>
        <h4>{t("judge.liveSqlTitle")}</h4>
        <p className="muted small">{t("judge.irreplaceableCaption")}</p>
        <pre className="sql-block judge-live-sql">{cannibalSql}</pre>
      </Card>

      <Card className="judge-why-not-llm">
        <h3>{t("judge.whyNotLlmTitle")}</h3>
        <p>{t("judge.whyNotLlmBody")}</p>
        <p className="judge-links">
          <Link to="/#formula-playground">{t("judge.playgroundLink")}</Link>
          {" · "}
          <a href={SCORER_GITHUB} target="_blank" rel="noreferrer">
            GreenlightScorer.ts
          </a>
        </p>
      </Card>

      <Card className="judge-benchmarks">
        <h3>{t("judge.benchmarksTitle")}</h3>
        <p className="muted small">{t("judge.benchmarksCaption")}</p>
        <table className="judge-benchmarks-table">
          <thead>
            <tr>
              <th>{t("judge.benchmarksEndpoint")}</th>
              <th>{t("judge.benchmarksP50")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GET /api/v1/greenlight (cached)</td>
              <td>~11 s</td>
            </tr>
            <tr>
              <td>GET /api/v1/greenlight?refresh=1</td>
              <td>~37 s</td>
            </tr>
            <tr>
              <td>POST /api/v1/agent/ask</td>
              <td>~33 s</td>
            </tr>
          </tbody>
        </table>
        <p className="muted small">{t("judge.keepaliveNote")}</p>
      </Card>

      {recommendations.length > 0 && greenlight && (
        <Card className="judge-slate-preview">
          <h3>{t("judge.slatePreviewTitle")}</h3>
          <p className="muted small">{t("greenlight.clickhouseAttribution")}</p>
          <div className="rec-grid judge-rec-grid">
            {recommendations.map((rec, i) => (
              <article key={`${rec.title}-${i}`} className="rec-card">
                <RecProvenanceStrip rec={rec} queryRows={queryRows} />
                <h4>{rec.title}</h4>
                <div className="rec-card-meta">
                  <span className="genre-pill">{rec.genre}</span>
                  <FillerDepthBadge title={rec.title} />
                </div>
                <dl className="rec-metrics rec-metrics-compact">
                  <div>
                    <dt>{t("dashboard.metricScore")}</dt>
                    <dd>
                      {metricsForRec(rec, queryRows).opportunity_score?.toFixed(3) ?? "—"}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <GreenlightSlateBar greenlight={greenlight} />
        </Card>
      )}

      <Card className="judge-arch">
        <h3>{t("judge.archTitle")}</h3>
        <ul className="judge-arch-list">
          <li>
            <strong>mcp-clickhouse</strong> — {t("judge.archMcp")}
          </li>
          <li>
            <strong>TypeScript scorer</strong> — {t("judge.archScorer")}
          </li>
          <li>
            <strong>@google/genai</strong> — {t("judge.archGemini")}
          </li>
        </ul>
        <p className="judge-scorer-note">{t("judge.scorerNote")}</p>
      </Card>

      <Card>
        <h3>{t("judge.linksTitle")}</h3>
        <p className="judge-links">
          <Link to="/">{t("judge.linkDashboard")}</Link>
          {" · "}
          <Link to="/#greenlight">{t("judge.linkGreenlight")}</Link>
          {" · "}
          <Link to="/ask">{t("judge.linkAsk")}</Link>
          {" · "}
          <a href={HEALTH_JSON}>{t("judge.linkHealth")}</a>
          {" · "}
          <a href={GREENLIGHT_REFRESH}>{t("judge.linkGreenlightApi")}</a>
        </p>
      </Card>

      <Card>
        <h3>{t("judge.verifyTitle")}</h3>
        <ol className="judge-checklist">
          <li>
            {t("judge.verifyWarm")} <code>GET {HEALTH_JSON}</code> → <code>ready: true</code>
            {" — "}
            {t("judge.verifyWarmBeforeAsk")}
          </li>
          <li>
            {t("judge.verifyGreenlight")} <code>GET {GREENLIGHT_REFRESH}</code>
          </li>
          <li>{t("judge.verifyAsk")}</li>
        </ol>
      </Card>

      <Card>
        <h3>{t("judge.exportTitle")}</h3>
        <p className="muted">{t("judge.exportBody")}</p>
        {!greenlight && <p className="muted small">{t("judge.waitingGreenlight")}</p>}
        <div className="judge-export-actions">
          <button type="button" className="btn primary" onClick={() => void onCopyEvidence()}>
            {copied ? t("judge.copied") : t("judge.copyJson")}
          </button>
          <button type="button" className="btn secondary" onClick={onDownloadEvidence}>
            {downloaded ? t("judge.downloaded") : t("judge.downloadJson")}
          </button>
        </div>
        {copyFailed && <p className="muted small">{t("judge.copyFailed")}</p>}
      </Card>
    </div>
  );
}
