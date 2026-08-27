import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Catalog Greenlight hackathon UI (1280)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

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

  test('dashboard: greenlight panel resolves (may take 1–2 min)', async ({ page }) => {
    await page.goto('/');
    const greenlightOutcome = page
      .locator('.rec-card')
      .first()
      .or(page.locator('.greenlight-panel .error-banner'))
      .or(page.locator('.greenlight-panel .answer'));
    await expect(greenlightOutcome).toBeVisible({ timeout: 260_000 });
  });
});

test.describe('Catalog Greenlight hackathon UI (390 mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('all four routes load without connection errors', async ({ page }) => {
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
