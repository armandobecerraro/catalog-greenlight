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
});
