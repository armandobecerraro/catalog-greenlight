import {
  parseGenreInventory,
  parseTitleMomentum,
  parseCannibalization,
  parseSlateHoles,
  buildLanguageGapMap,
  scoreTitles,
  pickTopCandidates,
  scoreFromAnalyticsById,
  slateDecisionTrace,
  candidatesToQueryRows,
  SCORER_WEIGHTS,
  SCORE_FROM_QUERIES,
  isNearDuplicateTitle,
  isSeedFillerTitle,
  type ScoredCandidate
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

  it('publishes language_gap as raw D_slate_holes gap_score (no max-normalization inflate)', () => {
    const holes = parseSlateHoles([
      { hole_type: 'language', dimension: 'es', gap_score: 0.0009 },
      { hole_type: 'language', dimension: 'pt', gap_score: 0.0004 },
      { hole_type: 'language', dimension: 'fr', gap_score: -0.01 },
      { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.071 }
    ]);
    const map = buildLanguageGapMap(holes);
    expect(map.get('es')).toBe(0.0009);
    expect(map.get('pt')).toBe(0.0004);
    expect(map.get('fr')).toBe(0);
    expect(map.has('Thriller')).toBe(false);

    const scored = scoreTitles(
      [
        {
          title_id: 'es-1',
          title: 'Crimen sin Fronteras: Bogotá',
          genre: 'Thriller',
          language: 'es',
          revenue_this_week: 420,
          revenue_prior_week: 180,
          wow_pct: 0.25,
          views_this_week: 85000
        },
        {
          title_id: 'en-1',
          title: 'Shadow Protocol',
          genre: 'Thriller',
          language: 'en',
          revenue_this_week: 310,
          revenue_prior_week: 280,
          wow_pct: 0.25,
          views_this_week: 45000
        }
      ],
      [{ genre: 'Thriller', title_count: 14, revenue_4w: 28000 }],
      [],
      holes
    );
    const es = scored.find(s => s.language === 'es')!;
    const en = scored.find(s => s.language === 'en')!;
    // Must match SQL semantics — never ~0.9 from dividing by a 0.001 floor.
    expect(es.language_gap).toBe(0.0009);
    expect(en.language_gap).toBe(0);
    expect(es.language_gap).toBeLessThan(0.01);
    expect(es.opportunity_score - en.opportunity_score).toBeCloseTo(
      SCORER_WEIGHTS.language_gap * 0.0009,
      6
    );
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
    const top = pickTopCandidates(scored, 3, 3);
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
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);

    expect(top).toHaveLength(3);
    expect(top.map(t => t.title)).toContain('Crimen sin Fronteras: Bogotá');
    expect(top.map(t => t.title)).toContain('Archive: Road 114');
    expect(top.map(t => t.title)).not.toContain('Archive: City 102');
    expect(new Set(top.map(t => t.genre)).size).toBe(3);
  });

  it('relaxes genre diversity before admitting fillers; fillers only with allowFiller', () => {
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
          title_id: 'comedy-filler',
          title: 'Banter Echo 7',
          genre: 'Comedy',
          language: 'en',
          revenue_this_week: 90,
          revenue_prior_week: 95,
          wow_pct: -0.05,
          views_this_week: 12000
        }
      ],
      DEMO_INVENTORY,
      DEMO_CANNIBAL,
      DEMO_HOLES
    );
    const jurySlate = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    expect(jurySlate).toHaveLength(3);
    expect(jurySlate.map(t => t.title)).not.toContain('Banter Echo 7');
    expect(jurySlate.every(t => !isSeedFillerTitle(t.title))).toBe(true);
    // Only two story genres → third pick reuses Documentary rather than filler
    expect(jurySlate.map(t => t.title)).toContain('Archive: City 102');

    const withFiller = pickTopCandidates(scored, 3, DEMO_INVENTORY.length, {
      allowFiller: true
    });
    // Still enough story titles (≥3) → filler stays out even with the flag
    expect(withFiller.map(t => t.title)).not.toContain('Banter Echo 7');

    const onlyTwoStory = pickTopCandidates(
      scored.filter(s => s.title !== 'Archive: City 102'),
      3,
      DEMO_INVENTORY.length,
      { allowFiller: true }
    );
    expect(onlyTwoStory.map(t => t.title)).toContain('Banter Echo 7');
  });

  it('never returns filler when at least three story candidates exist', () => {
    const scored = scoreTitles(
      [
        {
          title_id: 't1',
          title: 'Crimen sin Fronteras: Bogotá',
          genre: 'Thriller',
          language: 'es',
          revenue_this_week: 420,
          revenue_prior_week: 180,
          wow_pct: 0.32,
          views_this_week: 85000
        },
        {
          title_id: 't2',
          title: 'Archive: Road 114',
          genre: 'Documentary',
          language: 'en',
          revenue_this_week: 300,
          revenue_prior_week: 290,
          wow_pct: 0.05,
          views_this_week: 40000
        },
        {
          title_id: 't3',
          title: 'Harbor Letters: Winter',
          genre: 'Drama',
          language: 'es',
          revenue_this_week: 250,
          revenue_prior_week: 200,
          wow_pct: 0.25,
          views_this_week: 35000
        },
        {
          title_id: 'filler',
          title: 'Fading Line 75',
          genre: 'Comedy',
          language: 'en',
          revenue_this_week: 500,
          revenue_prior_week: 100,
          wow_pct: 4,
          views_this_week: 90000
        }
      ],
      DEMO_INVENTORY,
      [],
      DEMO_HOLES
    );
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length, { allowFiller: true });
    expect(top.map(t => t.title)).not.toContain('Fading Line 75');
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

  it('keeps seed-generator titles in momentum but prefers story titles for picks', () => {
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
    expect(rows.map(r => r.title)).toEqual([
      'Crimen sin Fronteras: Bogotá',
      'Fading Line 75'
    ]);

    const scored = scoreTitles(rows, DEMO_INVENTORY, [], DEMO_HOLES);
    const top = pickTopCandidates(scored, 1);
    expect(top[0]?.title).toBe('Crimen sin Fronteras: Bogotá');
  });

  it('covers parser fallbacks, language gaps, wow clamp, and cannibal fill', () => {
    expect(isSeedFillerTitle('')).toBe(true);
    expect(isSeedFillerTitle('Catalog Extra 12')).toBe(true);
    expect(isSeedFillerTitle('Fading Line 75')).toBe(true);
    expect(isSeedFillerTitle('Chronicle of Dream 103')).toBe(true);
    expect(isSeedFillerTitle('Harbor Letters: Winter')).toBe(false);
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

    const top = pickTopCandidates(scored, 3, 3);
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

  it('keeps default weights matching production fixtures', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    expect(top.map(t => t.title)).toEqual([
      'Crimen sin Fronteras: Bogotá',
      'Winter Harbor',
      'Open Mic Circuit'
    ]);
    const rows = candidatesToQueryRows(top);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        language_gap: expect.any(Number),
        scoreBreakdown: expect.objectContaining({
          fromQueries: SCORE_FROM_QUERIES,
          weights: SCORER_WEIGHTS
        })
      })
    );
  });

  it('changes ranked order when alternate weights are injected', () => {
    const production = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const languageOnly = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES, {
      genre_gap: 0,
      wow_momentum: 0,
      cannibalization_penalty: 0,
      language_gap: 1
    });
    expect(production.map(s => s.opportunity_score)).not.toEqual(
      languageOnly.map(s => s.opportunity_score)
    );
    expect(languageOnly.filter(s => s.language === 'es').every(s => s.opportunity_score > 0)).toBe(
      true
    );

    const fromId = scoreFromAnalyticsById(
      {
        A_genre_inventory: [
          { genre: 'Comedy', title_count: 52, revenue_4w: 12000 },
          { genre: 'Thriller', title_count: 14, revenue_4w: 28000 },
          { genre: 'Documentary', title_count: 22, revenue_4w: 22000 },
          { genre: 'Drama', title_count: 32, revenue_4w: 15000 }
        ],
        B_title_momentum: DEMO_MOMENTUM.map(t => ({ ...t })),
        C_cannibalization: [
          {
            title_a: 'True Crime: Highway 101',
            title_b: 'True Crime: Highway 101 Redux',
            genre: 'Documentary'
          }
        ],
        D_slate_holes: [
          { hole_type: 'genre', dimension: 'Thriller', gap_score: 0.42 },
          { hole_type: 'language', dimension: 'es', gap_score: 0.35 }
        ]
      },
      { weights: { genre_gap: 0, wow_momentum: 0, cannibalization_penalty: 0, language_gap: 1 } }
    );
    expect(fromId.scored.find(s => s.language === 'es')!.opportunity_score).toBeGreaterThan(
      fromId.scored.find(s => s.language === 'en')!.opportunity_score
    );
  });

  it('lets cannibal titles into the slate when relaxCannibal is set', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES, {
      ...SCORER_WEIGHTS,
      cannibalization_penalty: 0
    });
    const production = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    const relaxed = pickTopCandidates(scored, 3, DEMO_INVENTORY.length, { relaxCannibal: true });
    expect(production.every(t => !t.in_cannibal_pair)).toBe(true);
    expect(relaxed.some(t => t.in_cannibal_pair)).toBe(true);
  });

  it('can pick two titles in the same genre when relaxDiversity is set', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const production = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    const relaxed = pickTopCandidates(scored, 3, DEMO_INVENTORY.length, { relaxDiversity: true });
    expect(new Set(production.map(t => t.genre)).size).toBe(3);
    expect(relaxed.filter(t => t.genre === 'Thriller').length).toBeGreaterThan(
      production.filter(t => t.genre === 'Thriller').length
    );
  });

  it('traces first-pass cannibal exclusions and a runner-up', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    const trace = slateDecisionTrace(scored, top, DEMO_CANNIBAL, {
      inventoryGenreCount: DEMO_INVENTORY.length
    });
    expect(trace.cannibalExcluded.map(c => c.title)).toEqual(
      expect.arrayContaining(['True Crime: Highway 101', 'True Crime: Highway 101 Redux'])
    );
    expect(trace.cannibalExcluded[0].copy).toBe(
      'If you greenlit both, they split the same audience.'
    );
    expect(trace.runnerUp).toEqual(
      expect.objectContaining({
        title: expect.any(String),
        whyLost: expect.stringMatching(/lower_score|diversity|cannibal/)
      })
    );
    expect(top.map(t => t.title)).not.toContain(trace.runnerUp?.title);
  });

  it('fills remaining slots with cannibal fillers only on the last pick pass', () => {
    const scored = scoreTitles(
      [
        {
          title_id: 'story',
          title: 'Harbor Letters: Winter',
          genre: 'Drama',
          language: 'en',
          revenue_this_week: 100,
          revenue_prior_week: 90,
          wow_pct: 0.1,
          views_this_week: 1000
        },
        {
          title_id: 'f1',
          title: 'Banter Echo 7',
          genre: 'Comedy',
          language: 'en',
          revenue_this_week: 80,
          revenue_prior_week: 70,
          wow_pct: 0.1,
          views_this_week: 1000
        },
        {
          title_id: 'f2',
          title: 'Catalog Extra 12',
          genre: 'Thriller',
          language: 'en',
          revenue_this_week: 70,
          revenue_prior_week: 60,
          wow_pct: 0.1,
          views_this_week: 1000
        }
      ],
      [
        { genre: 'Drama', title_count: 10, revenue_4w: 10 },
        { genre: 'Comedy', title_count: 10, revenue_4w: 10 },
        { genre: 'Thriller', title_count: 10, revenue_4w: 10 }
      ],
      parseCannibalization([
        { title_a: 'Banter Echo 7', title_b: 'Banter Echo 7 Twin', genre: 'Comedy' },
        { title_a: 'Catalog Extra 12', title_b: 'Catalog Extra 12 Twin', genre: 'Thriller' }
      ]),
      []
    );
    expect(pickTopCandidates(scored, 3, 3)).toHaveLength(1);
    const withFiller = pickTopCandidates(scored, 3, 3, { allowFiller: true });
    expect(withFiller).toHaveLength(3);
    expect(withFiller.slice(1).every(t => isSeedFillerTitle(t.title))).toBe(true);
  });

  it('labels a leftover cannibal as whyLost cannibal when the skip list is empty', () => {
    const scored = scoreTitles(
      DEMO_MOMENTUM.filter(t => t.title.includes('Highway')),
      DEMO_INVENTORY,
      DEMO_CANNIBAL,
      DEMO_HOLES
    );
    const top = pickTopCandidates(scored, 0, DEMO_INVENTORY.length, { relaxCannibal: true });
    expect(top).toEqual([]);
    const trace = slateDecisionTrace(scored, top, DEMO_CANNIBAL, {
      relaxCannibal: true,
      inventoryGenreCount: DEMO_INVENTORY.length
    });
    expect(trace.runnerUp?.title).toMatch(/Highway 101/);
    expect(trace.runnerUp?.whyLost).toBe('cannibal');
  });

  it('covers first-pass skip loop edges in the decision trace', () => {
    const cand = (
      over: Partial<ScoredCandidate> & Pick<ScoredCandidate, 'title_id' | 'title' | 'genre'>
    ): ScoredCandidate => ({
      language: 'en',
      revenue_this_week: 1,
      revenue_prior_week: 1,
      wow_pct: 0,
      genre_gap: 0,
      wow_momentum: 0,
      cannibalization_penalty: 0,
      language_gap: 0,
      opportunity_score: 0.1,
      in_cannibal_pair: false,
      ...over
    });
    const scored = [
      cand({ title_id: 'p1', title: 'Pick One', genre: 'Drama', opportunity_score: 0.9 }),
      cand({ title_id: 'p1', title: 'Pick One', genre: 'Drama', opportunity_score: 0.89 }),
      cand({ title_id: '   ', title: '   ', genre: 'Western', opportunity_score: 0.88 }),
      cand({ title_id: 'fill', title: 'Banter Echo 7', genre: 'Comedy', opportunity_score: 0.5 }),
      cand({
        title_id: 'orphan',
        title: 'Orphan Cannibal',
        genre: 'Thriller',
        opportunity_score: 0.8,
        in_cannibal_pair: true
      }),
      cand({
        title_id: 'orphan',
        title: 'Orphan Cannibal',
        genre: 'Thriller',
        opportunity_score: 0.79,
        in_cannibal_pair: true
      }),
      cand({ title_id: 'p2', title: 'Pick Two', genre: 'Drama', opportunity_score: 0.7 }),
      cand({ title_id: 'p3', title: 'Pick Three', genre: 'Comedy', opportunity_score: 0.4 }),
      cand({ title_id: 'p4', title: 'Pick Four', genre: 'Documentary', opportunity_score: 0.3 })
    ];
    const top = [scored[0], scored[6], scored[7]];
    const noPair = slateDecisionTrace(scored, top, [], { relaxDiversity: true });
    expect(noPair.cannibalExcluded).toEqual([]);
    const withPair = slateDecisionTrace(
      scored,
      top,
      [{ title_a: 'Orphan Cannibal', title_b: 'Orphan Twin', genre: 'Thriller' }]
    );
    expect(withPair.cannibalExcluded.map(c => c.title)).toContain('Orphan Cannibal');
    expect(slateDecisionTrace(scored, top, []).runnerUp?.title).toBe('Orphan Cannibal');
  });
});
