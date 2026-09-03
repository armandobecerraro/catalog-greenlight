import { test, expect } from "@playwright/test";
import {
  expectGreenlightPicks,
  getGreenlightTitles,
  greenlightTimeout,
  isHosted,
  statsTimeout,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("Hosted smoke — catalog-greenlight.onrender.com", () => {
  test.skip(
    !isHosted,
    "Set BASE_URL to a non-localhost URL (e.g. https://catalog-greenlight.onrender.com)",
  );

  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("cg-locale", "en"));
  });

  test("API health: ready", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { ready: boolean; product: string; status: string };
    expect(body.ready).toBe(true);
    expect(body.product).toBe("Catalog Greenlight");
    expect(body.status).toBe("ok");
  });

  test("API stats: ~200 catalog entries", async ({ request }) => {
    const res = await request.get("/api/v1/catalog/stats");
    expect(res.ok()).toBeTruthy();
    const stats = (await res.json()) as { totalEntries: number };
    expect(stats.totalEntries).toBeGreaterThanOrEqual(150);
    expect(stats.totalEntries).toBeLessThanOrEqual(250);
  });

  test("API greenlight: 3 recommendations grounded in catalog", async ({ request }) => {
    test.setTimeout(greenlightTimeout + 60_000);
    const res = await request.get("/api/v1/greenlight", { timeout: greenlightTimeout });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      recommendations?: { title: string }[];
      intent: string;
    };
    expect(body.intent).toBe("greenlight");
    expect(body.recommendations).toBeDefined();
    expect(body.recommendations!.length).toBe(3);

    const catalogRes = await request.get("/api/v1/catalog");
    expect(catalogRes.ok()).toBeTruthy();
    const catalog = (await catalogRes.json()) as { entries: { title: string }[] };
    const catalogTitles = new Set(catalog.entries.map((e) => e.title));
    for (const rec of body.recommendations!) {
      expect(catalogTitles.has(rec.title)).toBe(true);
    }
  });

  test("UI dashboard: stats load and 3 greenlight cards", async ({ page }) => {
    test.setTimeout(greenlightTimeout + 60_000);
    await page.goto("/");
    await expect(page.getByText("Catalog size")).toBeVisible();
    const catalogStat = page.locator(".stat-value").first();
    await expect(catalogStat).not.toHaveText("0", { timeout: statsTimeout });
    await expect(page.getByText("Greenlight this week")).toBeVisible();

    await expectGreenlightPicks(page, { timeout: greenlightTimeout });
    const recTitles = await getGreenlightTitles(page);
    expect(recTitles.length).toBe(3);

    const catalogRes = await page.request.get("/api/v1/catalog");
    expect(catalogRes.ok()).toBeTruthy();
    const catalog = (await catalogRes.json()) as { entries: { title: string }[] };
    const catalogTitles = new Set(catalog.entries.map((e) => e.title));
    for (const t of recTitles) {
      expect(catalogTitles.has(t)).toBe(true);
    }
  });

  test("SPA: /greenlight, /catalog/stats, and unknown paths are never blank", async ({ page }) => {
    test.setTimeout(greenlightTimeout + 60_000);
    await page.goto("/does-not-exist");
    await expect(page.getByText(/Unknown route/i)).toBeVisible();
    await expect(page.getByRole("navigation")).toBeVisible();

    await page.goto("/catalog/stats");
    await expect(page.getByRole("heading", { name: "Catalog stats" })).toBeVisible({
      timeout: statsTimeout,
    });
    await expect(page.locator(".stat-value").first()).not.toHaveText("0", {
      timeout: statsTimeout,
    });

    await page.goto("/greenlight");
    await expect(page.getByText("Greenlight this week")).toBeVisible({
      timeout: greenlightTimeout,
    });

    await page.goto("/judge");
    await expect(page.getByRole("heading", { name: "For judges" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/How to verify in 2 minutes/i)).toBeVisible();
  });
});
