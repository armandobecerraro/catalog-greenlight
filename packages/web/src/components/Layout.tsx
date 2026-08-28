import { Link, NavLink, Outlet } from 'react-router-dom';
import { LanguageToggle, useLocale } from '../i18n/LocaleContext';
import type { AgentStep } from '../api';

export function Layout() {
  const { t } = useLocale();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand brand-link">
          <span className="brand-mark">CG</span>
          <div>
            <h1>Catalog Greenlight</h1>
            <p>{t('brand.tagline')}</p>
          </div>
        </Link>
        <div className="topbar-actions">
          <nav className="nav">
            <NavLink to="/" end>
              {t('nav.dashboard')}
            </NavLink>
            <NavLink to="/catalog">{t('nav.catalog')}</NavLink>
            <NavLink to="/ingest">{t('nav.ingest')}</NavLink>
            <NavLink to="/ask">{t('nav.ask')}</NavLink>
          </nav>
          <LanguageToggle />
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        {t('footer')} · <Link to="/guia">{t('footerGuide')}</Link>
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
  const { t } = useLocale();
  return <div className="loading">{t('common.loading')}</div>;
}

export function AgentTimeline({ steps }: { steps: AgentStep[] }) {
  const { t } = useLocale();

  return (
    <ol className="timeline">
      {steps.map((s, i) => (
        <li key={i} className={`timeline-step status-${s.status}`}>
          <div className="timeline-head">
            <strong>{t(`steps.${s.step}`)}</strong>
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
