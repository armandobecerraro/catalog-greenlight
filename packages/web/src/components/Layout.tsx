import { Link, NavLink, Outlet } from 'react-router-dom';
import { LanguageToggle, useLocale } from '../i18n/LocaleContext';

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
            <NavLink to="/guia">{t('nav.about')}</NavLink>
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

export function Card({
  children,
  className = '',
  id
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`card ${className}`}>
      {children}
    </section>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

export function EmptyState({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{body}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function Loading() {
  const { t } = useLocale();
  return <div className="loading">{t('common.loading')}</div>;
}

export { AgentTimeline } from './AgentTimeline';

export { Link };
