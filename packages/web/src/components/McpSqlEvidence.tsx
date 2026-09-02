import { useState } from 'react';
import type { AgentRunResult } from '../api';
import { useLocale } from '../i18n/LocaleContext';

interface DiscoverQuery {
  id: string;
  sql?: string;
  rowCount?: number;
  latencyMs?: number;
  error?: string;
}

function queriesFromGreenlight(greenlight: AgentRunResult | null): DiscoverQuery[] {
  const discover = greenlight?.steps?.find(s => s.step === 'DISCOVER');
  if (!discover?.output || typeof discover.output !== 'object') return [];
  const queries = (discover.output as { queries?: DiscoverQuery[] }).queries;
  return Array.isArray(queries) ? queries.filter(q => q.sql) : [];
}

export function McpSqlEvidence({ greenlight }: { greenlight: AgentRunResult | null }) {
  const { t } = useLocale();
  const queries = queriesFromGreenlight(greenlight);
  const [openId, setOpenId] = useState<string | null>(null);

  if (queries.length === 0) return null;

  return (
    <section className="mcp-sql-evidence" aria-label={t('dashboard.mcpSqlTitle')}>
      <h3 className="analytics-heading">{t('dashboard.mcpSqlTitle')}</h3>
      <p className="muted small">{t('dashboard.mcpSqlSub')}</p>
      <ul className="mcp-sql-list">
        {queries.map(q => {
          const open = openId === q.id;
          return (
            <li key={q.id} className="mcp-sql-item">
              <button
                type="button"
                className="mcp-sql-toggle"
                onClick={() => setOpenId(open ? null : q.id)}
                aria-expanded={open}
              >
                <span className="mcp-sql-id">{q.id}</span>
                <span className="muted small">
                  {q.error
                    ? t('dashboard.mcpSqlError')
                    : t('dashboard.mcpSqlMeta', {
                        rows: Number(q.rowCount ?? 0),
                        ms: Number(q.latencyMs ?? 0)
                      })}
                </span>
              </button>
              {open && q.sql && <pre className="sql-block mcp-sql-block">{q.sql}</pre>}
              {open && q.error && <p className="timeline-error">{q.error}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
