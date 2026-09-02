import {
  groundRecommendations,
  recommendationsFromCandidateRows,
  normalizeTitle,
  candidateTitleSet,
  buildFallbackEvidence,
  buildFallbackJustification
} from '../../src/greenlight/groundRecommendations';

describe('groundRecommendations', () => {
  const candidates = [
    {
      title: 'Crimen sin Fronteras: Bogotá',
      genre: 'Thriller',
      opportunity_score: 0.58,
      wow_pct: 1.33,
      genre_gap: 0.41,
      in_cannibal_pair: false
    },
    {
        title: 'Winter Harbor',
      genre: 'Drama',
      opportunity_score: 0.26,
      wow_pct: 0.25,
      genre_gap: 0.16,
      in_cannibal_pair: false
    }
  ];

  it('matches titles case-insensitively with trim', () => {
    const { recommendations, usedFallback } = groundRecommendations(
      [{ title: '  crimen sin fronteras: bogotá  ', genre: 'Thriller', justification: 'x', evidence: 'y' }],
      candidates
    );
    expect(usedFallback).toBe(false);
    expect(recommendations[0].title).toBe('Crimen sin Fronteras: Bogotá');
    expect(recommendations[0].opportunity_score).toBe(0.58);
  });

  it('falls back to scorer candidates when none survive grounding', () => {
    const { recommendations, usedFallback } = groundRecommendations(
      [{ title: 'Hallucinated Title', genre: 'Sci-Fi', justification: 'nope', evidence: 'nope' }],
      candidates
    );
    expect(usedFallback).toBe(true);
    expect(recommendations).toHaveLength(2);
    expect(recommendations[0].title).toBe('Crimen sin Fronteras: Bogotá');
    expect(recommendations[0].justification).toContain('Crimen sin Fronteras: Bogotá');
    expect(recommendations[0].justification).toContain('TypeScript formula');
  });

  it('falls back to three scorer rows when Gemini returns empty', () => {
    const three = [
      ...candidates,
      {
        title: 'Open Mic Circuit',
        genre: 'Comedy',
        opportunity_score: 0.09,
        wow_pct: -0.05,
        genre_gap: 0,
        in_cannibal_pair: false
      }
    ];
    const { recommendations, usedFallback } = groundRecommendations([], three);
    expect(usedFallback).toBe(true);
    expect(recommendations).toHaveLength(3);
  });

  it('builds fallback evidence from measured fields', () => {
    const recs = recommendationsFromCandidateRows(candidates);
    expect(recs[0].evidence).toContain('opportunity_score=0.58');
    expect(recs[0].evidence).toContain('wow_pct=1.33');
    expect(normalizeTitle(recs[0].title)).toBe(normalizeTitle('Crimen sin Fronteras: Bogotá'));
  });

  it('skips candidate rows with empty titles', () => {
    const recs = recommendationsFromCandidateRows([
      { title: '', genre: 'Drama', opportunity_score: 0.1, wow_pct: 0, genre_gap: 0 },
      {
        title: 'Crimen sin Fronteras: Bogotá',
        genre: 'Thriller',
        opportunity_score: 0.58,
        wow_pct: 1.33,
        genre_gap: 0.41
      }
    ]);
    expect(recs).toHaveLength(1);
    expect(recs[0].title).toBe('Crimen sin Fronteras: Bogotá');
  });

  it('covers string metrics, missing fields, and empty candidate sets', () => {
    expect(candidateTitleSet([{ title: 1 }, { title: '  Keep  ' }]).has('keep')).toBe(true);
    expect(groundRecommendations(undefined, [{ title: 'X', genre: 'Drama' }]).usedFallback).toBe(true);
    expect(buildFallbackJustification({ title: 9 })).toMatch(/^This title/);

    const stringRow = {
      title: 'String Title',
      genre: 'Drama',
      opportunity_score: '0.5',
      wow_pct: '0.2',
      genre_gap: '0.1',
      in_cannibal_pair: true
    };
    const grounded = groundRecommendations(
      [{ title: 'String Title', genre: 'Drama', justification: 'j', evidence: 'e' }],
      [stringRow]
    );
    expect(grounded.usedFallback).toBe(false);
    expect(grounded.recommendations[0].opportunity_score).toBe(0.5);
    expect(grounded.recommendations[0].in_cannibal_pair).toBe(true);

    const empty = { title: '  ', genre: 9 };
    expect(buildFallbackJustification(empty)).toMatch(/^This title/);
    const groundedMissing = groundRecommendations(
      [{ title: 'String Title', genre: 'Kept', justification: 'j', evidence: 'e', opportunity_score: 9, wow_pct: 8, genre_gap: 7, in_cannibal_pair: false }],
      [{ title: 'String Title' }]
    );
    expect(groundedMissing.recommendations[0].opportunity_score).toBe(9);
    expect(groundedMissing.recommendations[0].genre).toBe('Kept');

    expect(recommendationsFromCandidateRows([{ title: 'Solo' }])[0].genre).toBe('');
    expect(buildFallbackEvidence({ title: 'X' })).toContain('n/a');
    expect(recommendationsFromCandidateRows([empty, { wow_pct: '', genre_gap: 0 }])).toEqual([]);
  });
});
