import type { HealthStatus } from '../api';
import { useLocale } from '../i18n/LocaleContext';

export function TrustStrip({ health }: { health: HealthStatus | null }) {
  const { t } = useLocale();
  const partners = health?.partners;

  return (
    <div className="trust-strip" role="status">
      <p className="trust-strip-pitch">{t('dashboard.trustPitch')}</p>
      <ul className="trust-strip-badges">
        <li className={badgeClass(partners?.clickhouse)}>
          <span className="trust-badge-label">ClickHouse</span>
          <span className="trust-badge-value">{partners?.clickhouse ?? t('health.starting')}</span>
        </li>
        <li className={badgeClass(partners?.mcp)}>
          <span className="trust-badge-label">MCP</span>
          <span className="trust-badge-value">{partners?.mcp ?? 'mcp-clickhouse'}</span>
        </li>
        <li className={badgeClass(partners?.gemini)}>
          <span className="trust-badge-label">Gemini</span>
          <span className="trust-badge-value">{partners?.gemini ?? t('health.starting')}</span>
        </li>
      </ul>
    </div>
  );
}

function badgeClass(status: string | undefined): string {
  const ok = status && /connected|gemini/i.test(status);
  return `trust-badge${ok ? ' is-ok' : ''}`;
}
