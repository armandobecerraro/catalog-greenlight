# Hosted smoke verification — Catalog Greenlight

**URL:** https://catalog-greenlight.onrender.com  
**Verified:** 2026-09-02  
**Platform:** Render (free tier — service may spin down after inactivity; first request can take 30–60s)

---

## 1. curl smoke (API)

### Health

```bash
curl -sS https://catalog-greenlight.onrender.com/api/v1/health
```

```json
{"status":"ok","product":"Catalog Greenlight","ready":true,"error":null,"timestamp":"2026-09-02T03:43:26.132Z"}
```

| Check | Result |
|-------|--------|
| HTTP 200 | PASS |
| `ready: true` | PASS |
| `product: Catalog Greenlight` | PASS |

---

### Catalog stats (~200 titles)

```bash
curl -sS https://catalog-greenlight.onrender.com/api/v1/catalog/stats
```

```json
{
  "totalEntries": 200,
  "genres": {
    "Comedy": 52,
    "Drama": 39,
    "Documentary": 22,
    "Action": 18,
    "Romance": 16,
    "Thriller": 15,
    "Sci-Fi": 14,
    "Horror": 14,
    "Animation": 10
  },
  "recentAdditions": 200,
  "topCast": [
    { "name": "Actor B", "count": 190 },
    { "name": "Actor A", "count": 190 },
    { "name": "Actor", "count": 7 },
    { "name": "Host", "count": 2 },
    { "name": "Gael García Bernal", "count": 1 }
  ],
  "latestRevenue": {
    "totalViews": 8580304,
    "totalRevenueUsd": 63217.4,
    "topTitle": "Crimen sin Fronteras: Bogotá"
  }
}
```

| Check | Result |
|-------|--------|
| HTTP 200 | PASS |
| `totalEntries` ≈ 200 | PASS (200) |
| `latestRevenue.totalViews` > 0 | PASS |

---

### Greenlight (3 recommendations)

```bash
curl -sS https://catalog-greenlight.onrender.com/api/v1/greenlight
```

Response summary (cached run, ~0.4s):

```json
{
  "intent": "greenlight",
  "cached": true,
  "recommendation_count": 3,
  "recommendations": [
    "Chronicle of Dream 111",
    "Always Line 152",
    "Quantum City 172"
  ]
}
```

| Check | Result |
|-------|--------|
| HTTP 200 | PASS |
| `intent: greenlight` | PASS |
| Exactly 3 recommendations | PASS |
| All titles exist in `/api/v1/catalog` | PASS |

**Note:** Cold greenlight (cache miss or `?refresh=1`) can take **1–3 minutes** on Render free tier. The API caches results for 10 minutes.

---

## 2. Playwright hosted smoke

**Spec:** `packages/web/e2e/hosted-smoke.spec.ts`  
**Helpers:** `packages/web/e2e/helpers.ts` (timeouts: greenlight 240s, stats 120s when `BASE_URL` is non-localhost)

### Commands

```bash
# From repo root (requires Playwright browsers: npx playwright install chromium)
npm run test:e2e:hosted

# Or from packages/web
cd packages/web
BASE_URL=https://catalog-greenlight.onrender.com npm run test:e2e:hosted
```

Local full E2E (unchanged — requires `npm run dev`):

```bash
npm run test:e2e
```

### Results (2026-09-02)

```
Running 4 tests using 1 worker
  ✓ API health: ready (380ms)
  ✓ API stats: ~200 catalog entries (753ms)
  ✓ API greenlight: 3 recommendations grounded in catalog (650ms)
  ✓ UI dashboard: stats load and 3 greenlight cards (1.7s)

  4 passed (7.9s)
```

| Test | Status | Notes |
|------|--------|-------|
| API health: ready | **PASS** | `ready: true` |
| API stats: ~200 catalog entries | **PASS** | `totalEntries: 200` |
| API greenlight: 3 recs grounded in catalog | **PASS** | cached response |
| UI dashboard: stats + 3 greenlight cards | **PASS** | `.rec-card` count = 3 |

---

## 3. Local E2E changes (no regression)

| File | Change |
|------|--------|
| `playwright.config.ts` | `BASE_URL` env (default `http://localhost:5173`); longer timeouts when hosted |
| `hackathon.spec.ts` | Greenlight asserts **3** rec-cards (was `>= 1`); hosted-aware timeouts via helpers |
| `package.json` | `test:e2e` → `hackathon.spec.ts` only; new `test:e2e:hosted` script |

---

## 4. Summary

| Category | Hosted ready? |
|----------|---------------|
| Health endpoint | **YES** |
| Stats (~200 titles) | **YES** |
| Greenlight 3 picks | **YES** (cached fast; cold 1–3 min) |
| Playwright hosted smoke | **YES** (4/4 pass) |
| Full local hackathon E2E | Unchanged — run with `npm run dev` + `npm run test:e2e` |
