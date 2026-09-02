/** Shared E2E helpers — BASE_URL switches local vs hosted timeouts. */
export const baseURL = process.env.BASE_URL ?? 'http://localhost:5173';

export const isHosted =
  Boolean(process.env.BASE_URL) && !/localhost|127\.0\.0\.1/.test(process.env.BASE_URL);

/** Greenlight can take 1–3 min on cold Render; cached runs are fast. */
export const greenlightTimeout = isHosted ? 240_000 : 120_000;

/** Stats/catalog rows on hosted may lag while the service wakes up. */
export const statsTimeout = isHosted ? 120_000 : 60_000;

export const catalogRowTimeout = isHosted ? 120_000 : 60_000;

/** Real picks only — loading skeletons also use article.rec-card. */
export const greenlightPickLocator = 'article.rec-card:not(.rec-card-skeleton)';

export const greenlightTitleLocator = 'article.rec-card:not(.rec-card-skeleton) h4';
