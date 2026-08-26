import { Link, NavLink, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">CG</span>
          <div>
            <h1>Catalog Greenlight</h1>
            <p>The agent that tells programming what to push — with ClickHouse evidence.</p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/catalog">Catalog</NavLink>
          <NavLink to="/ingest">Ingest</NavLink>
          <NavLink to="/ask">Ask the Catalog</NavLink>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        Agentic Cinema · ClickHouse track · Gemini + mcp-clickhouse
      </footer>
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="page-header">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

export function Loading() {
  return <div className="loading">Loading…</div>;
}

export function AgentTimeline({ steps }: { steps: import('../api').AgentStep[] }) {
  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={i} className={`timeline-step status-${s.status}`}>
          <div className="timeline-head">
            <strong>{s.step}</strong>
            <span>{s.latencyMs != null ? `${s.latencyMs}ms` : s.status}</span>
          </div>
          {s.error && <p className="timeline-error">{s.error}</p>}
          {s.output != null && (
            <pre className="timeline-output">{JSON.stringify(s.output, null, 2).slice(0, 800)}</pre>
          )}
        </li>
      ))}
    </ol>
  );
}

export { Link };
