import {
  parseGenreInventory,
  parseTitleMomentum,
  parseCannibalization,
  parseSlateHoles,
  scoreTitles,
  pickTopCandidates,
  scoreFromAnalyticsById,
  SCORER_WEIGHTS,
  isNearDuplicateTitle
} from '../../src/greenlight/GreenlightScorer';

/** Demo-story fixtures — mirrors seeded ClickHouse narrative. */
const DEMO_INVENTORY = parseGenreInventory([
  { genre: 'Comedy', title_count: 52, revenue_4w: 12000 },
  { genre: 'Thriller', title_count: 14, revenue_4w: 28000 },
  { genre: 'Documentary', title_count: 22, revenue_4w: 22000 },
  { genre: 'Drama', title_count: 32, revenue_4w: 15000 }
]);

const DEMO_MOMENTUM = parseTitleMomentum([
  {
    title_id: 'breakout',
    title: 'Crimen sin Fronteras: Bogotá',
    genre: 'Thriller',
    language: 'es',
    revenue_this_week: 420,
    revenue_prior_week: 180,
    wow_pct: 1.33,
    views_this_week: 85000
  },
  {
    title_id: 'cannibal-a',
    title: 'True Crime: Highway 101',
    genre: 'Documentary',
    language: 'en',
    revenue_this_week: 950,
    revenue_prior_week: 920,
    wow_pct: 0.03,
    views_this_week: 90000
  },
  {
    title_id: 'cannibal-b',
    title: 'True Crime: Highway 101 Redux',
    genre: 'Documentary',
    language: 'en',
    revenue_this_week: 930,
    revenue_prior_week: 910,
    wow_pct: 0.02,
    views_this_week: 88000
  },
  {
    title_id: 'comedy-weak',
    title: 'Open Mic Circuit',
    genre: 'Comedy',
    language: 'en',
    revenue_this_week: 90,
    revenue_prior_week: 95,
    wow_pct: -0.05,
    views_this_week: 12000
  },
  {
    title_id: 'thriller-2',
    title: 'Shadow Protocol',
    genre: 'Thriller',
    language: 'en',
    revenue_this_week: 310,
    revenue_prior_week: 280,
    wow_pct: 0.11,
    views_this_week: 45000
  },
  {
    title_id: 'drama-hole',
    title: 'Winter Harbor',
    genre: 'Drama',
    language: 'es',
    revenue_this_week: 250,
    revenue_prior_week: 200,
    wow_pct: 0.25,
    views_this_week: 38000
  }
]);

const DEMO_CANNIBAL = parseCannibalization([
  {
    title_a: 'True Crime: Highway 101',
    title_b: 'True Crime: Highway 101 Redux',
    genre: 'Documentary'
  }
]);

const DEMO_HOLES = parseSlateHoles([
  { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.42 },
  { hole_type: 'language', dimension: 'es', gap_score: 0.35 }
]);

describe('GreenlightScorer', () => {
  it('uses explicit opportunity formula weights', () => {
    expect(SCORER_WEIGHTS).toEqual({
      genre_gap: 0.4,
      wow_momentum: 0.4,
      cannibalization_penalty: 0.2,
      language_gap: 0.05
    });
  });

  it('ranks LATAM breakout above cannibal pair and weak comedy', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const breakout = scored.find(s => s.title === 'Crimen sin Fronteras: Bogotá')!;
    const cannibalA = scored.find(s => s.title === 'True Crime: Highway 101')!;
    const comedy = scored.find(s => s.title === 'Open Mic Circuit')!;

    expect(breakout.in_cannibal_pair).toBe(false);
    expect(cannibalA.in_cannibal_pair).toBe(true);
    expect(cannibalA.cannibalization_penalty).toBe(1);
    expect(breakout.opportunity_score).toBeGreaterThan(cannibalA.opportunity_score);
    expect(breakout.opportunity_score).toBeGreaterThan(comedy.opportunity_score);
  });

  it('picks top 3 with genre diversity and rejects cannibal titles when better options exist', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const top = pickTopCandidates(scored, 3);
    const titles = top.map(t => t.title);

    expect(titles).toContain('Crimen sin Fronteras: Bogotá');
    expect(titles).not.toContain('True Crime: Highway 101');
    expect(titles).not.toContain('True Crime: Highway 101 Redux');
    expect(new Set(top.map(t => t.genre)).size).toBe(3);
  });

  it('scores full momentum rows — timeline slice must not change picks', () => {
    const filler = Array.from({ length: 22 }, (_, i) => ({
      title_id: `f${i}`,
      title: `Filler ${i}`,
      genre: 'Comedy',
      language: 'en',
      revenue_this_week: 50,
      revenue_prior_week: 52,
      wow_pct: -0.04,
      views_this_week: 1000
    }));
    const momentum = [
      ...filler,
      {
        title_id: 'late-breakout',
        title: 'Late Breakout Thriller',
        genre: 'Thriller',
        language: 'es',
        revenue_this_week: 500,
        revenue_prior_week: 200,
        wow_pct: 1.5,
        views_this_week: 90000
      }
    ];
    const inventory = [
      { genre: 'Comedy', title_count: 40, revenue_4w: 8000 },
      { genre: 'Thriller', title_count: 8, revenue_4w: 30000 }
    ];
    const full = scoreFromAnalyticsById({
      A_genre_inventory: inventory,
      B_title_momentum: momentum,
      C_cannibalization: [],
      D_slate_holes: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.5 }]
    });
    const truncated = scoreFromAnalyticsById({
      A_genre_inventory: inventory,
      B_title_momentum: momentum.slice(0, 20),
      C_cannibalization: [],
      D_slate_holes: [{ hole_type: 'genre', dimension: 'Thriller', gap_score: 0.5 }]
    });

    expect(full.top[0]?.title).toBe('Late Breakout Thriller');
    expect(truncated.top.map(t => t.title)).not.toContain('Late Breakout Thriller');
  });

  it('treats Highway 101 + Redux as a cannibal pair but not unrelated thrillers', () => {
    expect(isNearDuplicateTitle('True Crime: Highway 101', 'True Crime: Highway 101 Redux')).toBe(true);
    expect(isNearDuplicateTitle('Shadow Road 86', 'Crimen sin Fronteras: Bogotá')).toBe(false);
  });

  it('drops numbered seed-generator titles from momentum', () => {
    const rows = parseTitleMomentum([
      {
        title_id: 'story',
        title: 'Crimen sin Fronteras: Bogotá',
        genre: 'Thriller',
        language: 'es',
        revenue_this_week: 420,
        revenue_prior_week: 180,
        wow_pct: 1.33,
        views_this_week: 85000
      },
      {
        title_id: 'filler',
        title: 'Fading Line 75',
        genre: 'Drama',
        language: 'en',
        revenue_this_week: 250,
        revenue_prior_week: 200,
        wow_pct: 0.29,
        views_this_week: 38000
      }
    ]);
    expect(rows.map(r => r.title)).toEqual(['Crimen sin Fronteras: Bogotá']);
  });
});
