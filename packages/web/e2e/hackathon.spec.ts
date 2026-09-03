import { test, expect } from '@playwright/test';
import {
  catalogRowTimeout,
  expectGreenlightPicks,
  getGreenlightTitles,
  statsTimeout,
  waitForAskTimeline,
  waitForIngestSuccess
} from './helpers';

test.describe('Catalog Greenlight hackathon UI (1280)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cg-locale', 'en'));
  });

  test('catalog: dozens of rows', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page.getByText(/\d+( of \d+)? titles in ClickHouse/)).toBeVisible({ timeout: 30_000 });
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: catalogRowTimeout });
    const count = await rows.count();
    expect(count).toBeGreaterThan(10);
  });

  test('ingest: unique title appears in catalog', async ({ page }) => {
    const uniqueTitle = `E2E Ingest ${Date.now()}`;
    await page.goto('/ingest');
    await page.getByLabel('Title').fill(uniqueTitle);
    await page.getByLabel('Description').fill('Playwright E2E ingest — sci-fi test title for hackathon verification.');
    await page.getByLabel('Release date').fill('2025-12-01');
    await page.getByLabel('Cast (comma-separated)').fill('Test Actor One');
    await page.getByRole('button', { name: /Ingest via agent pipeline/i }).click();
    const ingestOutcome = await waitForIngestSuccess(page);
    test.skip(ingestOutcome === 'gemini', 'Gemini API unavailable (429/credits exhausted)');

    await page.goto('/catalog');
    await page.getByPlaceholder('Filter by title or genre').fill(uniqueTitle);
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 30_000 });
  });

  test('ask: 6 completed steps, SQL, and numeric answer', async ({ page }) => {
    await page.goto('/ask');
    await page.getByLabel('Your question').fill('Which genre is under-represented?');
    await page.getByRole('button', { name: 'Run agent' }).click();

    const askOutcome = await waitForAskTimeline(page);
    test.skip(askOutcome === 'gemini', 'Gemini API unavailable (429/credits exhausted)');
    await expect(page.locator('.timeline-step.status-completed')).toHaveCount(6, { timeout: 260_000 });
    await expect(page.getByText('SQL executed (MCP run_query)')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Evidence/ })).toBeVisible();

    const answer = page.locator('.answer');
    await expect(answer).toBeVisible();
    const answerText = await answer.textContent();
    expect(answerText).toMatch(/\d/);
  });

  test('dashboard: stats load in catalog snapshot', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Greenlight this week')).toBeVisible();
    await page.getByRole('button', { name: /Show catalog snapshot/i }).click();
    await expect(page.getByText('Catalog size')).toBeVisible();
    const catalogStat = page.locator('.stat-value').first();
    await expect(catalogStat).not.toHaveText('0', { timeout: statsTimeout });
  });

  test('dashboard: greenlight shows 3 titles from catalog evidence', async ({ page, request }) => {
    await page.goto('/');
    await expectGreenlightPicks(page);
    const recTitles = await getGreenlightTitles(page);
    expect(recTitles.length).toBe(3);

    const catalogRes = await request.get('/api/v1/catalog');
    expect(catalogRes.ok()).toBeTruthy();
    const catalog = (await catalogRes.json()) as { entries: { title: string }[] };
    const catalogTitles = new Set(catalog.entries.map(e => e.title));
    for (const t of recTitles) {
      expect(catalogTitles.has(t)).toBe(true);
    }
  });

  test('legacy paths never show a blank screen', async ({ page }) => {
    await page.goto('/greenlight');
    await expect(page.getByText('Greenlight this week')).toBeVisible({ timeout: 60_000 });

    await page.goto('/catalog/stats');
    await expect(page.getByRole('heading', { name: 'Catalog stats' })).toBeVisible({ timeout: 60_000 });

    await page.goto('/does-not-exist');
    await expect(page.getByText(/Unknown route/i)).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('Catalog Greenlight hackathon UI (390 mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cg-locale', 'en'));
  });

  test('all routes load without connection errors', async ({ page }) => {
    await page.goto('/guia');
    await expect(page.getByRole('heading', { name: 'User Guide', exact: false })).toBeVisible({ timeout: 30_000 });

    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: 'Catalog', exact: true })).toBeVisible({ timeout: 60_000 });

    await page.goto('/ingest');
    await expect(page.getByText('Ingest a title')).toBeVisible();

    await page.goto('/ask');
    await expect(page.getByRole('heading', { name: 'Ask the catalog' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByText('Programming Dashboard')).toBeVisible({ timeout: 60_000 });
  });

  test('legacy paths never show a blank screen', async ({ page }) => {
    await page.goto('/greenlight');
    await expect(page.getByText('Greenlight this week')).toBeVisible({ timeout: 60_000 });

    await page.goto('/catalog/stats');
    await expect(page.getByRole('heading', { name: 'Catalog stats' })).toBeVisible({ timeout: 60_000 });

    await page.goto('/does-not-exist');
    await expect(page.getByText(/Unknown route/i)).toBeVisible();
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
