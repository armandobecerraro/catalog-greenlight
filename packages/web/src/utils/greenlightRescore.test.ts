import { describe, expect, it } from 'vitest';
import { SCORER_WEIGHTS } from './greenlightMetrics';
import {
  parseGenreInventory,
  parseTitleMomentum,
  parseCannibalization,
  parseSlateHoles,
  scoreTitles,
  pickTopCandidates,
  slateDecisionTrace,
  rescoreFromDiscover,
  hasDiscoverRows,
  isNearDuplicateTitle,
  isSeedFillerTitle
} from './greenlightRescore';

/** Same DEMO fixtures as packages/orchestration/tests/unit/GreenlightScorer.test.ts */
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

const DEMO_BY_ID = {
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
};

describe('greenlightRescore', () => {
  it('matches production DEMO picks with default weights', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    expect(top.map(t => t.title)).toEqual([
      'Crimen sin Fronteras: Bogotá',
      'Winter Harbor',
      'Open Mic Circuit'
    ]);
    expect(SCORER_WEIGHTS).toEqual({
      genre_gap: 0.4,
      wow_momentum: 0.4,
      cannibalization_penalty: 0.2,
      language_gap: 0.05
    });
  });

  it('keeps language_gap equal to D_slate_holes gap_score (no inflate)', () => {
    const scored = scoreTitles(
      DEMO_MOMENTUM,
      DEMO_INVENTORY,
      DEMO_CANNIBAL,
      parseSlateHoles([
        { hole_type: 'language', dimension: 'es', gap_score: 0.0009 },
        { hole_type: 'language', dimension: 'pt', gap_score: 0.0004 }
      ])
    );
    const es = scored.find(s => s.language === 'es')!;
    expect(es.language_gap).toBe(0.0009);
    expect(es.language_gap).toBeLessThan(0.01);
  });

  it('changes preview order when weights change', () => {
    const preview = rescoreFromDiscover(DEMO_BY_ID, {
      weights: { genre_gap: 0, wow_momentum: 0, cannibalization_penalty: 0, language_gap: 1 }
    });
    const production = rescoreFromDiscover(DEMO_BY_ID);
    expect(preview.scored.map(s => s.opportunity_score)).not.toEqual(
      production.scored.map(s => s.opportunity_score)
    );
    const wowHeavy = rescoreFromDiscover(DEMO_BY_ID, {
      weights: { genre_gap: 0, wow_momentum: 1, cannibalization_penalty: 0, language_gap: 0 },
      relaxDiversity: true
    });
    expect(wowHeavy.top.map(t => t.title)).not.toEqual(production.top.map(t => t.title));
  });

  it('changes the 3 picks when cannibal or diversity flags are relaxed', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES, {
      ...SCORER_WEIGHTS,
      cannibalization_penalty: 0
    });
    const production = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    const relaxedCannibal = pickTopCandidates(scored, 3, DEMO_INVENTORY.length, {
      relaxCannibal: true
    });
    expect(production.every(t => !t.in_cannibal_pair)).toBe(true);
    expect(relaxedCannibal.some(t => t.in_cannibal_pair)).toBe(true);

    const defaultScored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const relaxedDiv = pickTopCandidates(defaultScored, 3, DEMO_INVENTORY.length, {
      relaxDiversity: true
    });
    expect(relaxedDiv.filter(t => t.genre === 'Thriller').length).toBeGreaterThan(1);
  });

  it('traces cannibal exclusions from the first pick pass', () => {
    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    const trace = slateDecisionTrace(scored, top, DEMO_CANNIBAL, {
      inventoryGenreCount: DEMO_INVENTORY.length
    });
    expect(trace.cannibalExcluded.map(c => c.title)).toEqual(
      expect.arrayContaining(['True Crime: Highway 101', 'True Crime: Highway 101 Redux'])
    );
    expect(hasDiscoverRows(null)).toBe(false);
    expect(hasDiscoverRows(DEMO_BY_ID)).toBe(true);
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
    expect(pickTopCandidates(scored, 3, 3, { allowFiller: true })).toHaveLength(3);
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

  it('mirrors scorer near-duplicate and first-pass skip edges', () => {
    expect(isNearDuplicateTitle('', 'x')).toBe(false);
    expect(isNearDuplicateTitle('Catalog Extra 12', '')).toBe(false);
    expect(isSeedFillerTitle('')).toBe(true);
    expect(isSeedFillerTitle('Catalog Extra 12')).toBe(true);
    expect(isSeedFillerTitle('Winter Harbor', 'catalog title for demo seed')).toBe(true);
    expect(isSeedFillerTitle('Winter Harbor', 'padding title')).toBe(true);
    expect(parseGenreInventory([{ title_count: 'nope', revenue_4w: 'x' }])[0].title_count).toBe(0);
    expect(parseGenreInventory([{ title_count: '4', revenue_4w: '10' }])[0].title_count).toBe(4);
    expect(isNearDuplicateTitle('abcdefghijklmnopXXX', 'abcdefghijklmnopYYY')).toBe(true);
    expect(isNearDuplicateTitle('shadow protocol one', 'shadow protocol two')).toBe(true);
    expect(isNearDuplicateTitle('101', 'Highway 101')).toBe(true);
    expect(isNearDuplicateTitle('abcd efg hij', 'abcd efg xyz')).toBe(false);

    const scored = scoreTitles(DEMO_MOMENTUM, DEMO_INVENTORY, DEMO_CANNIBAL, DEMO_HOLES);
    expect(pickTopCandidates(scored).length).toBeGreaterThan(0);
    expect(rescoreFromDiscover({}).top).toEqual([]);
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
      []
    );
    expect(unknownGenre[0].genre_gap).toBe(0);
    expect(unknownGenre[0].language_gap).toBe(0);
    const cannibal = scored.find(s => s.in_cannibal_pair)!;
    const withDup = [
      ...scored,
      { ...scored[0] },
      { ...scored[0], title: '   ' },
      { ...cannibal },
      { ...cannibal, title_id: 'fill-x', title: 'Banter Echo 7' }
    ];
    const top = pickTopCandidates(scored, 3, DEMO_INVENTORY.length);
    const noPair = slateDecisionTrace(withDup, top, [], { relaxDiversity: true });
    expect(noPair.cannibalExcluded).toEqual([]);
    const withPair = slateDecisionTrace(withDup, top, DEMO_CANNIBAL);
    expect(withPair.cannibalExcluded.map(c => c.title)).toEqual(
      expect.arrayContaining(['True Crime: Highway 101', 'True Crime: Highway 101 Redux'])
    );
  });
});
