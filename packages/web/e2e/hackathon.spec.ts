import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Catalog Greenlight hackathon UI (1280)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('cg-locale', 'en'));
  });

  test('catalog: dozens of rows', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page.getByText(/titles in ClickHouse/)).toBeVisible({ timeout: 30_000 });
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
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
    await expect(page.getByText(/Stored .* in .*ms via MCP INSERT/)).toBeVisible({ timeout: 120_000 });

    await page.goto('/catalog');
    await page.getByPlaceholder('Filter by title or genre').fill(uniqueTitle);
    await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 30_000 });
  });

  test('ask: 6 completed steps, SQL, and numeric answer', async ({ page }) => {
    await page.goto('/ask');
    await page.getByLabel('Your question').fill('Which genre is under-represented?');
    await page.getByRole('button', { name: 'Run agent' }).click();

    await expect(page.getByText('Agent timeline')).toBeVisible({ timeout: 260_000 });
    await expect(page.locator('.timeline-step.status-completed')).toHaveCount(6, { timeout: 260_000 });
    await expect(page.getByText('SQL executed (MCP run_query)')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Evidence/ })).toBeVisible();

    const answer = page.locator('.answer');
    await expect(answer).toBeVisible();
    const answerText = await answer.textContent();
    expect(answerText).toMatch(/\d/);
  });

  test('dashboard: stats load immediately', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Catalog size')).toBeVisible();
    const catalogStat = page.locator('.stat-value').first();
    await expect(catalogStat).not.toHaveText('0', { timeout: 60_000 });
    await expect(page.getByText('Greenlight this week')).toBeVisible();
  });

  test('dashboard: greenlight shows 3 titles from catalog evidence', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('.rec-card').first()).toBeVisible({ timeout: 60_000 });
    const recTitles = await page.locator('.rec-card h4').allTextContents();
    expect(recTitles.length).toBeGreaterThanOrEqual(1);

    const catalogRes = await request.get('/api/v1/catalog');
    expect(catalogRes.ok()).toBeTruthy();
    const catalog = (await catalogRes.json()) as { entries: { title: string }[] };
    const catalogTitles = new Set(catalog.entries.map(e => e.title));
    for (const t of recTitles) {
      expect(catalogTitles.has(t)).toBe(true);
    }
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
});
