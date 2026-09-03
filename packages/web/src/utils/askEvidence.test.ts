import { describe, expect, it } from 'vitest';
import { gapScoreHighlight, hasClickHouseEvidence } from './askEvidence';

describe('askEvidence', () => {
  it('detects ClickHouse evidence from sql, rows, or gap_score answer', () => {
    expect(hasClickHouseEvidence({ sql: 'SELECT 1', queryRows: [], answer: '' })).toBe(true);
    expect(hasClickHouseEvidence({ sql: '', queryRows: [{ genre: 'Documentary' }], answer: '' })).toBe(
      true
    );
    expect(
      hasClickHouseEvidence({
        sql: '',
        queryRows: [],
        answer: 'Documentary gap_score 0.074 from ClickHouse'
      })
    ).toBe(true);
    expect(hasClickHouseEvidence({ sql: '  ', queryRows: [], answer: 'no measured rows' })).toBe(
      false
    );
  });

  it('builds a gap_score highlight from rows or answer text', () => {
    expect(
      gapScoreHighlight({
        answer: '',
        queryRows: [
          { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.05 },
          { hole_type: 'genre', dimension: 'Documentary', gap_score: 0.074 }
        ]
      })
    ).toBe('Documentary: gap_score 0.074');

    expect(
      gapScoreHighlight({
        answer: '',
        queryRows: [{ genre: 'Comedy', gap_score: '0.12' }]
      })
    ).toBe('Comedy: gap_score 0.120');

    expect(
      gapScoreHighlight({
        answer: '',
        queryRows: [{ hole_type: 'genre', gap_score: 0.02 }]
      })
    ).toBe('gap_score 0.020');

    expect(
      gapScoreHighlight({
        answer: 'Documentary is underserved: gap_score 0.074 (revenue share minus title share).',
        queryRows: []
      })
    ).toBe('gap_score 0.074');

    expect(gapScoreHighlight({ answer: 'nothing measured', queryRows: [] })).toBeNull();
    expect(gapScoreHighlight({ answer: '', queryRows: [{ gap_score: 'nope' }] })).toBeNull();
    expect(
      gapScoreHighlight({ answer: undefined as unknown as string, queryRows: undefined })
    ).toBeNull();
  });
});
