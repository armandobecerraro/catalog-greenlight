import { expect, type Page } from '@playwright/test';

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
export const greenlightCardLocator = 'article.rec-card:not(.rec-card-skeleton)';

/** Ritual slate table rows (same three titles as rec-cards when loaded). */
export const greenlightSlateRowLocator = 'tr.greenlight-slate-row';

/** @deprecated Prefer greenlightCardLocator — kept for existing imports. */
export const greenlightPickLocator = greenlightCardLocator;

export const greenlightTitleLocator = `${greenlightCardLocator} h4`;

export const greenlightSlateTitleLocator = `${greenlightSlateRowLocator}[data-title]`;

export const geminiErrorPattern =
  /Gemini API credits are exhausted|rate-limited \(429\)/i;

export const ingestSuccessPattern = /Stored .* in .*ms via MCP INSERT/;

/** Wait for ingest success or detect Gemini unavailability (fail fast). */
export async function waitForIngestSuccess(
  page: Page,
  timeout = 120_000
): Promise<'success' | 'gemini'> {
  const success = page.getByText(ingestSuccessPattern);
  const geminiErr = page.getByText(geminiErrorPattern);
  return Promise.race([
    success.waitFor({ state: 'visible', timeout }).then(() => 'success' as const),
    geminiErr.waitFor({ state: 'visible', timeout }).then(() => 'gemini' as const)
  ]);
}

/** Wait for ask agent timeline or detect Gemini unavailability (fail fast). */
export async function waitForAskTimeline(
  page: Page,
  timeout = 260_000
): Promise<'success' | 'gemini'> {
  const timeline = page.getByText('Agent timeline');
  const geminiErr = page.getByText(geminiErrorPattern);
  return Promise.race([
    timeline.waitFor({ state: 'visible', timeout }).then(() => 'success' as const),
    geminiErr.waitFor({ state: 'visible', timeout }).then(() => 'gemini' as const)
  ]);
}

/** Assert three greenlight picks via rec-cards; also checks slate rows when ritual panel renders. */
export async function expectGreenlightPicks(
  page: Page,
  opts: { count?: number; timeout?: number } = {}
): Promise<void> {
  const count = opts.count ?? 3;
  const timeout = opts.timeout ?? greenlightTimeout;
  const cards = page.locator(greenlightCardLocator);
  await expect(cards).toHaveCount(count, { timeout });

  const rows = page.locator(greenlightSlateRowLocator);
  if ((await rows.count()) > 0) {
    await expect(rows).toHaveCount(count);
    await expect(page.locator(greenlightTitleLocator)).toHaveCount(count);
  }
}

/** Titles from rec-card headings, falling back to slate row data-title attributes. */
export async function getGreenlightTitles(page: Page): Promise<string[]> {
  const fromCards = await page.locator(greenlightTitleLocator).allTextContents();
  if (fromCards.length >= 3) return fromCards;

  return page.locator(greenlightSlateRowLocator).evaluateAll(els =>
    els.map(el => el.getAttribute('data-title') ?? '').filter(Boolean)
  );
}
