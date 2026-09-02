import {
  validateGeneratedSql,
  validateAuditSql,
  SqlValidationError
} from '../../../src/utils/sqlValidation';

describe('sqlValidation', () => {
  it('allows SELECT for catalog_qa', () => {
    expect(() =>
      validateGeneratedSql('SELECT genre, count() FROM media_catalog.media_content GROUP BY genre', 'catalog_qa')
    ).not.toThrow();
  });

  it('blocks DROP for any intent', () => {
    expect(() => validateGeneratedSql('DROP TABLE media_content', 'catalog_qa')).toThrow(SqlValidationError);
  });

  it('blocks INSERT for greenlight intent', () => {
    expect(() =>
      validateGeneratedSql('INSERT INTO media_catalog.media_content VALUES (...)', 'greenlight')
    ).toThrow(SqlValidationError);
  });

  it('allows INSERT for ingest intent', () => {
    expect(() =>
      validateGeneratedSql('INSERT INTO media_catalog.media_content (id) VALUES (\'x\')', 'ingest')
    ).not.toThrow();
  });

  it('allows INSERT for audit helper', () => {
    expect(() =>
      validateAuditSql('INSERT INTO media_catalog.agent_runs (id) VALUES (\'x\')')
    ).not.toThrow();
  });

  it('audit allows Gemini prose containing system keyword in quoted values', () => {
    expect(() =>
      validateAuditSql(
        "INSERT INTO media_catalog.agent_runs (response_summary) VALUES ('database system error reported')"
      )
    ).not.toThrow();
  });

  it('ignores forbidden keywords inside comments and quoted strings', () => {
    expect(() =>
      validateGeneratedSql("SELECT 'DROP TABLE x' -- DELETE FROM t\nFROM media_catalog.media_content", 'catalog_qa')
    ).not.toThrow();
  });

  it('rejects audit SQL that is not an INSERT into agent_runs', () => {
    expect(() => validateAuditSql('SELECT 1')).toThrow(SqlValidationError);
    expect(() =>
      validateAuditSql("INSERT INTO media_catalog.media_content (id) VALUES ('x')")
    ).toThrow(SqlValidationError);
    expect(() =>
      validateAuditSql("INSERT INTO media_catalog.agent_runs (id) VALUES ('x'); DROP TABLE media_catalog.agent_runs")
    ).toThrow(/Forbidden SQL keyword in audit/);
  });

  it('rejects greenlight SQL that is not SELECT/WITH', () => {
    expect(() => validateGeneratedSql('EXPLAIN SELECT 1', 'stats')).toThrow(SqlValidationError);
  });

  it('treats comment-only SQL as unknown keyword', () => {
    expect(() => validateGeneratedSql('/* comment only */', 'catalog_qa')).toThrow(/unknown/);
    expect(() => validateGeneratedSql('/* comment only */', 'ingest')).toThrow(/unknown/);
    expect(() => validateAuditSql('/* comment only */')).toThrow(/unknown/);
  });
});
