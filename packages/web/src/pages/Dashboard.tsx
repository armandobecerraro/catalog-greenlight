import { useEffect, useState } from 'react';
import { api, AgentRunResult, CatalogStats } from '../api';
import { PageHeader, Card, Loading, ErrorBanner, AgentTimeline, Link } from '../components/Layout';

export default function Dashboard() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [greenlight, setGreenlight] = useState<AgentRunResult | null>(null);
  const [statsError, setStatsError] = useState('');
  const [greenlightError, setGreenlightError] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [greenlightLoading, setGreenlightLoading] = useState(true);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch(e => setStatsError(e instanceof Error ? e.message : 'Failed to load stats'))
      .finally(() => setStatsLoading(false));

    api
      .getGreenlight()
      .then(setGreenlight)
      .catch(e => setGreenlightError(e instanceof Error ? e.message : 'Greenlight agent failed'))
      .finally(() => setGreenlightLoading(false));
  }, []);

  if (statsLoading) return <Loading />;

  return (
    <>
      <PageHeader
        title="Programming Dashboard"
        subtitle="Live catalog stats from ClickHouse via MCP · Weekly greenlight picks from the agent"
      />

      {statsError && <ErrorBanner message={statsError} />}

      <div className="grid-3">
        <Card>
          <h3>Catalog size</h3>
          <p className="stat-value">{stats?.totalEntries ?? 0}</p>
          <p className="muted">{stats?.recentAdditions ?? 0} added in last 30 days</p>
        </Card>
        <Card>
          <h3>Genres tracked</h3>
          <p className="stat-value">{Object.keys(stats?.genres ?? {}).length}</p>
          <ul className="genre-list">
            {Object.entries(stats?.genres ?? {})
              .slice(0, 5)
              .map(([g, c]) => (
                <li key={g}>
                  {g}: {c}
                </li>
              ))}
          </ul>
        </Card>
        <Card>
          <h3>Latest revenue (7d)</h3>
          {stats?.latestRevenue ? (
            <>
              <p className="stat-value">${stats.latestRevenue.totalRevenueUsd.toFixed(0)}</p>
              <p className="muted">{stats.latestRevenue.totalViews.toLocaleString()} views</p>
              <p className="muted">Top: {stats.latestRevenue.topTitle}</p>
            </>
          ) : (
            <p className="muted">No revenue data</p>
          )}
        </Card>
      </div>

      <Card className="greenlight-panel">
        <div className="panel-head">
          <h3>Greenlight this week</h3>
          {greenlight?.model && <span className="badge">{greenlight.model}</span>}
        </div>
        {greenlightLoading && <p className="muted">Running greenlight agent (Gemini + MCP, may take 1–2 min)…</p>}
        {greenlightError && <ErrorBanner message={greenlightError} />}
        {!greenlightLoading && greenlight?.recommendations && greenlight.recommendations.length > 0 ? (
          <div className="rec-grid">
            {greenlight.recommendations.map((r, i) => (
              <article key={i} className="rec-card">
                <h4>{r.title}</h4>
                <span className="genre-pill">{r.genre}</span>
                <p>{r.justification}</p>
                <p className="evidence">Evidence: {r.evidence}</p>
              </article>
            ))}
          </div>
        ) : (
          !greenlightLoading && greenlight?.answer && <p>{greenlight.answer}</p>
        )}
        {greenlight && (
          <>
            <p className="muted">
              Agent run {greenlight.totalLatencyMs}ms ·{' '}
              <Link to="/ask">Ask follow-up questions →</Link>
            </p>
            {greenlight.steps && <AgentTimeline steps={greenlight.steps} />}
          </>
        )}
      </Card>
    </>
  );
}
