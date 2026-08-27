import { AgentIntent } from '../ports/outbound/IGeminiReasoningPort';

const FORBIDDEN_KEYWORDS = [
  'DROP',
  'ALTER',
  'TRUNCATE',
  'DELETE',
  'CREATE DATABASE',
  'CREATE TABLE',
  'ATTACH',
  'DETACH',
  'RENAME',
  'GRANT',
  'REVOKE',
  'SYSTEM',
  'KILL'
];

export class SqlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlValidationError';
  }
}

/** Strip comments and normalize for keyword checks. */
function normalizeSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
    .toUpperCase();
}

function firstStatementKeyword(sql: string): string {
  const match = normalizeSql(sql).match(/^(\w+)/);
  return match?.[1] ?? '';
}

function stripQuotedStrings(sql: string): string {
  return sql.replace(/'(?:''|[^'])*'/g, "'");
}

export function validateGeneratedSql(sql: string, intent: AgentIntent): void {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new SqlValidationError('Empty SQL is not allowed');
  }

  const normalized = normalizeSql(stripQuotedStrings(sql));
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (new RegExp(`\\b${keyword.replace(/ /g, '\\s+')}\\b`).test(normalized)) {
      throw new SqlValidationError(`Forbidden SQL keyword: ${keyword}`);
    }
  }

  const keyword = firstStatementKeyword(sql);

  if (intent === 'catalog_qa' || intent === 'stats' || intent === 'greenlight') {
    if (keyword !== 'SELECT' && keyword !== 'WITH') {
      throw new SqlValidationError(
        `Intent "${intent}" allows only SELECT/WITH queries; got ${keyword || 'unknown'}`
      );
    }
    return;
  }

  if (intent === 'ingest') {
    if (keyword !== 'INSERT') {
      throw new SqlValidationError(`Intent "ingest" allows only INSERT; got ${keyword || 'unknown'}`);
    }
  }
}

export function validateAuditSql(sql: string): void {
  const keyword = firstStatementKeyword(sql);
  if (keyword !== 'INSERT') {
    throw new SqlValidationError(`Audit log must use INSERT; got ${keyword || 'unknown'}`);
  }
  const stripped = stripQuotedStrings(sql);
  if (!/\bINSERT\s+INTO\s+media_catalog\.agent_runs\b/i.test(stripped)) {
    throw new SqlValidationError('Audit INSERT must target media_catalog.agent_runs');
  }
  const normalized = normalizeSql(stripped);
  for (const keyword of ['DROP', 'ALTER', 'TRUNCATE', 'DELETE']) {
    if (new RegExp(`\\b${keyword}\\b`).test(normalized)) {
      throw new SqlValidationError(`Forbidden SQL keyword in audit: ${keyword}`);
    }
  }
}
