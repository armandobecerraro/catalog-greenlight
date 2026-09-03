import {
  parseGenreInventory,
  parseTitleMomentum,
  parseCannibalization,
  parseSlateHoles,
  scoreTitles,
  pickTopCandidates,
  scoreFromAnalyticsById,
  SCORER_WEIGHTS,
  isNearDuplicateTitle,
  isSeedFillerTitle
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

  it('backfill respects genre diversity when cannibal filtering leaves slots open', () => {
    const scored = scoreTitles(
      [
        {
          title_id: 'breakout',
          title: 'Crimen sin Fronteras: Bogotá',
          genre: 'Thriller',
          language: 'es',
          revenue_this_week: 420,
          revenue_prior_week: 180,
          wow_pct: 0.32,
          views_this_week: 85000
        },
        {
          title_id: 'doc-1',
          title: 'Archive: Road 114',
          genre: 'Documentary',
          language: 'en',
          revenue_this_week: 300,
          revenue_prior_week: 290,
          wow_pct: 0.021,
          views_this_week: 40000
        },
        {
          title_id: 'doc-2',
          title: 'Archive: City 102',
          genre: 'Documentary',
          language: 'en',
          revenue_this_week: 280,
          revenue_prior_week: 330,
          wow_pct: -0.162,
          views_this_week: 38000
        },
        {
          title_id: 'drama-fill',
          title: 'Winter Harbor',
          genre: 'Drama',
          language: 'es',
          revenue_this_week: 250,
          revenue_prior_week: 200,
          wow_pct: 0.25,
          views_this_week: 38000
        }
      ],
      DEMO_INVENTORY,
      DEMO_CANNIBAL,
      DEMO_HOLES
    );
    const top = pickTopCandidates(scored, 3);

    expect(top).toHaveLength(3);
    expect(top.map(t => t.title)).toContain('Crimen sin Fronteras: Bogotá');
    expect(top.map(t => t.title)).toContain('Archive: Road 114');
    expect(top.map(t => t.title)).not.toContain('Archive: City 102');
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

  it('covers parser fallbacks, language gaps, wow clamp, and cannibal fill', () => {
    expect(isSeedFillerTitle('')).toBe(true);
    expect(isSeedFillerTitle('Catalog Extra 12')).toBe(true);
    expect(isSeedFillerTitle('Winter Harbor', 'catalog title for demo seed')).toBe(true);
    expect(isSeedFillerTitle('Two Words')).toBe(false);

    const inventory = parseGenreInventory([
      { genre: 'Drama', title_count: '4', revenue_4w: '10' },
      { genre: null, title_count: {}, revenue_4w: undefined }
    ]);
    expect(inventory[0].title_count).toBe(4);
    expect(inventory[1].revenue_4w).toBe(0);
    expect(parseGenreInventory([{ title_count: 'nope', revenue_4w: 'x' }])[0].title_count).toBe(0);

    expect(scoreFromAnalyticsById({}).top).toEqual([]);

    const unknownGenre = scoreTitles(
      [
        {
          title_id: 'u',
          title: 'Unknown Genre Title',
          genre: 'Western',
          language: 'fr',
          revenue_this_week: 1,
          revenue_prior_week: 10,
          wow_pct: -1,
          views_this_week: 1
        }
      ],
      [],
      [],
      [{ hole_type: 'language', dimension: 'es', gap_score: -2 }]
    );
    expect(unknownGenre[0].genre_gap).toBe(0);
    expect(unknownGenre[0].language_gap).toBe(0);
    expect(unknownGenre[0].wow_momentum).toBe(0);

    const momentum = parseTitleMomentum([
      { title: '   ', genre: 'Drama' },
      {
        title_id: 9,
        title: 'Measured Title',
        genre: 'Drama',
        language: '',
        revenue_this_week: '5',
        revenue_prior_week: '2',
        wow_pct: '1.6',
        views_this_week: '3'
      }
    ]);
    expect(momentum).toHaveLength(1);
    expect(momentum[0].language).toBe('en');
    expect(momentum[0].wow_pct).toBe(1.6);

    expect(parseCannibalization([{ title_a: 'Same', title_b: 'Same', genre: 'Drama' }])).toEqual([]);
    expect(isNearDuplicateTitle('', 'x')).toBe(false);
    expect(isNearDuplicateTitle('abcdefghijklmnopXXX', 'abcdefghijklmnopYYY')).toBe(true);
    expect(isNearDuplicateTitle('shadow protocol one', 'shadow protocol two')).toBe(true);
    expect(isNearDuplicateTitle('abcdef hij klm xxxx', 'abcdef hij klm yyyy')).toBe(true);

    const scored = scoreTitles(
      [
        {
          title_id: 'a',
          title: 'Alpha Drama',
          genre: 'Drama',
          language: 'es',
          revenue_this_week: 100,
          revenue_prior_week: 10,
          wow_pct: 2,
          views_this_week: 1
        },
        {
          title_id: 'b',
          title: 'Beta Drama',
          genre: 'Drama',
          language: 'en',
          revenue_this_week: 90,
          revenue_prior_week: 80,
          wow_pct: 0.1,
          views_this_week: 1
        },
        {
          title_id: 'c',
          title: 'Cannibal Comedy A',
          genre: 'Comedy',
          language: 'en',
          revenue_this_week: 80,
          revenue_prior_week: 70,
          wow_pct: 0.1,
          views_this_week: 1
        },
        {
          title_id: 'd',
          title: 'Cannibal Comedy B',
          genre: 'Comedy',
          language: 'en',
          revenue_this_week: 70,
          revenue_prior_week: 60,
          wow_pct: 0.1,
          views_this_week: 1
        },
        {
          title_id: 'e',
          title: 'Thriller Fill',
          genre: 'Thriller',
          language: 'en',
          revenue_this_week: 60,
          revenue_prior_week: 50,
          wow_pct: 0.1,
          views_this_week: 1
        }
      ],
      [
        { genre: 'Drama', title_count: 10, revenue_4w: 10 },
        { genre: 'Comedy', title_count: 10, revenue_4w: 10 },
        { genre: 'Thriller', title_count: 10, revenue_4w: 10 }
      ],
      parseCannibalization([
        { title_a: 'Cannibal Comedy A', title_b: 'Cannibal Comedy B extra', genre: 'Comedy' }
      ]),
      parseSlateHoles([
        { hole_type: 'language', dimension: 'es', gap_score: '0.8' },
        { hole_type: 'genre', dimension: 'Drama', gap_score: 0.1 }
      ])
    );

    const top = pickTopCandidates(scored, 3);
    expect(top[0].title).toBe('Alpha Drama');
    expect(top.map(t => t.genre).includes('Drama')).toBe(true);
    expect(pickTopCandidates(scored).length).toBeGreaterThan(0);
    expect(pickTopCandidates(scored, 1)).toHaveLength(1);

    const onlyCannibals = pickTopCandidates(
      scored.map(s => ({ ...s, in_cannibal_pair: true })),
      3
    );
    expect(onlyCannibals).toHaveLength(3);

    expect(pickTopCandidates([{ ...scored[0], title: '   ' }], 3)).toEqual([]);
  });
});
