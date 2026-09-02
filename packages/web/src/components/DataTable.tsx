import { useLocale } from '../i18n/LocaleContext';

export function DataTable({
  rows,
  maxRows = 20,
  className = ''
}: {
  rows: Record<string, unknown>[];
  maxRows?: number;
  className?: string;
}) {
  const { t } = useLocale();

  if (!rows.length) {
    return null;
  }

  const displayRows = rows.slice(0, maxRows);
  const columns = Object.keys(displayRows[0] ?? {});

  if (!columns.length) {
    return null;
  }

  return (
    <div className={`table-wrap ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col}>{formatCell(row[col], t)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <p className="muted small table-more">
          {t('steps.moreRows', { count: rows.length - maxRows })}
        </p>
      )}
    </div>
  );
}

function formatCell(value: unknown, t: (key: string) => string): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? t('steps.cellYes') : t('steps.cellNo');
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/\.?0+$/, '');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
