import { describe, expect, it } from 'vitest';
import { filterRecommendations, isPlausibleGenre, isPlausibleRecommendation } from './recommendationGuards';

describe('recommendationGuards', () => {
  it('rejects ISO-like junk genres', () => {
    expect(isPlausibleGenre('Thriller')).toBe(true);
    expect(isPlausibleGenre('es')).toBe(false);
    expect(isPlausibleGenre('a')).toBe(false);
    expect(isPlausibleGenre('Abc')).toBe(false);
    expect(isPlausibleGenre(undefined)).toBe(false);
    expect(filterRecommendations(undefined)).toEqual([]);
    expect(isPlausibleRecommendation({ title: 'A', genre: 'Thriller', justification: '', evidence: '' })).toBe(false);
  });

  it('accepts plausible Title Case genre labels', () => {
    expect(isPlausibleGenre('Mock Genre')).toBe(true);
  });

  it('rejects empty titles and scorer pick placeholders', () => {
    expect(isPlausibleRecommendation({ title: '', genre: 'Thriller', justification: '', evidence: '' })).toBe(false);
    expect(
      isPlausibleRecommendation({ title: 'Scorer pick: foo', genre: 'Thriller', justification: '', evidence: '' })
    ).toBe(false);
  });

  it('rejects single-character titles', () => {
    expect(isPlausibleRecommendation({ title: 'A', genre: 'Thriller', justification: '', evidence: '' })).toBe(false);
  });

  it('filters recommendations with junk genres', () => {
    const recs = [
      { title: 'Crimen sin Fronteras: Bogotá', genre: 'Thriller', justification: 'a', evidence: 'b' },
      { title: 'Bad row', genre: 'es', justification: 'a', evidence: 'b' }
    ];
    expect(filterRecommendations(recs)).toHaveLength(1);
    expect(isPlausibleRecommendation(recs[1])).toBe(false);
  });

  it('handles undefined recommendation lists', () => {
    expect(filterRecommendations(undefined)).toEqual([]);
    expect(isPlausibleRecommendation({ title: undefined as unknown as string, genre: 'Thriller', justification: '', evidence: '' })).toBe(
      false
    );
  });
});
