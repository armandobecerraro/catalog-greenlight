import type { Recommendation } from '../api';

/** Genre labels we seed in the demo catalog — also accepts plausible Title Case names. */
const KNOWN_GENRES = new Set([
  'Action',
  'Animation',
  'Comedy',
  'Documentary',
  'Drama',
  'Horror',
  'Romance',
  'Sci-Fi',
  'Thriller'
]);

/** ISO-639-1 style tokens that sometimes leak from bad API payloads (e.g. `es`). */
const JUNK_GENRE = /^[a-z]{2}$/i;

export function isPlausibleGenre(genre: string | undefined | null): boolean {
  if (!genre) return false;
  const g = genre.trim();
  if (g.length < 3 || JUNK_GENRE.test(g)) return false;
  if (KNOWN_GENRES.has(g)) return true;
  return /^[A-Z][\w-]*(?:\s+[A-Z][\w-]*)*$/.test(g) && g.length >= 4;
}

export function isPlausibleRecommendation(rec: Recommendation): boolean {
  const title = rec.title?.trim() ?? '';
  if (!title || title.length < 2) return false;
  if (/^scorer pick:/i.test(title)) return false;
  return isPlausibleGenre(rec.genre);
}

export function filterRecommendations(recs: Recommendation[] | undefined): Recommendation[] {
  return (recs ?? []).filter(isPlausibleRecommendation);
}
