# Hosted smoke verification — Catalog Greenlight

**URL:** https://catalog-greenlight.onrender.com  
**Verified:** 2026-09-04T04:57:00Z (pre-fix diagnosis) · **Code fix packed:** anti-filler + SYNTHESIZE 25s + seed story titles (pending Render deploy + ClickHouse reseed)  
**Platform:** Render (free tier — cold start 60–90s pre-warm after spin-down)

### 60-second judge path

| Step | Action | Expect |
|------|--------|--------|
| 1 | Open hosted URL; wait health `ready: true` | ~60–90s if cold |
| 2 | `/` dashboard | 3 greenlight picks with measured scores · **0 fillers** |
| 3 | `/ask` → under-represented genre chip | Documentary `gap_score ≈ 0.074` |
| 4 | `/judge` | Chloe wedge + Remove ClickHouse + benchmarks |

**p50 (warm):** greenlight cached ~11s · `?refresh=1` ~37s · `/ask` ~33s — see [`BENCHMARKS.md`](./BENCHMARKS.md). Keep-alive: `bash scripts/keepalive-smoke.sh` or `npm run keepalive:smoke`.

> **Keep-alive (opcional):** UptimeRobot o cron cada 5 min contra `/api/v1/health` evita spin-down; no requiere provisioning ni pago en tier free.

```bash
# Judging / grabación — solo health (no cron de ?refresh=1)
BASE_URL=https://catalog-greenlight.onrender.com bash scripts/keepalive-smoke.sh
```

### Smoke scripts

| Script | npm | Use |
|--------|-----|-----|
| `scripts/keepalive-smoke.sh` | `npm run keepalive:smoke` | **Judging-week cron** — health wake + cached greenlight (no `?refresh=1`, no `/agent/ask`) |
| `scripts/judge-smoke.sh` | `npm run judge:smoke` | **Full judge-path QA** — health + greenlight + ask (`gap_score` + SQL) + `/judge` HTML |

**Cold-start flakiness:** Render free tier may return 502/503 or time out on the first request after spin-down. Both scripts retry health wake (`MAX_WAKE_ATTEMPTS`, default 6 × 15s). `judge-smoke.sh` also retries `/api/v1/agent/ask` up to `MAX_ASK_ATTEMPTS` (default 3) with `ASK_TIMEOUT_SEC` 240s — a failed ask on a cold instance is expected; re-run or let retries succeed.

```bash
# Judging-week cron (safe — does not spam ask or refresh)
BASE_URL=https://catalog-greenlight.onrender.com npm run keepalive:smoke

# Pre-demo / post-deploy judge verification
BASE_URL=https://catalog-greenlight.onrender.com npm run judge:smoke
```

---

## Re-smoke 2026-09-04 (pre-deploy diagnosis)

| Check | Result | Evidence |
|-------|--------|----------|
| `GET /api/v1/health` | **PASS** | `ready: true`, partners clickhouse+mcp+`gemini-2.0-flash` @ `2026-09-04T04:56:50Z` |
| `GET /api/v1/catalog/stats` | **PASS** | `totalEntries: 200`, `latestRevenue.topTitle: Crimen sin Fronteras: Bogotá` |
| `GET /api/v1/greenlight?refresh=1` | **FAIL fillers** | Top-3: Bogotá / Archive: Road 114 / **Fading Line 75** (seed filler) |
| SYNTHESIZE | **FAIL timeout** | `latencyMs: 10001`, `fallback: true`, answer = “Gemini memo is optional.” |
| `POST /api/v1/agent/ask` under-represented | **PASS** | Documentary `gap_score` 0.074 + `D_slate_holes` SQL + 6 steps |

### Fixes shipped in this commit (need Render auto-deploy from `main` + reseed)

1. **Anti-filler:** Query B + ask fallback SQL exclude `Catalog Extra*`, `Scorer pick:*`, and `Word Word N` without colon; scorer never admits fillers when ≥3 story candidates (relaxes diversity first); seed adds `Harbor Letters: Winter` (Drama) + `Late Night: Banter Room` (Comedy).
2. **SYNTHESIZE:** timeout **25s**; slim Flash prompt (no 6k SQL dump).
3. **Cast polish:** stats `topCast` filters `Actor` / `Actor A–Z`; UI `formatCast` hides synthetic names.

**Post-deploy checklist:**

```bash
# 1) After Render builds from main — reseed ClickHouse Cloud once
set -a && source .env && set +a && bash deployment/scripts/seed-remote.sh

# 2) Warm + verify
curl -sS --max-time 120 https://catalog-greenlight.onrender.com/api/v1/health
curl -sS --max-time 180 'https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1'
# Expect: 0 fillers; SYNTHESIZE.fallback !== true on ≥1 of 2 warm runs; answer ≠ “Gemini memo is optional.”

BASE_URL=https://catalog-greenlight.onrender.com npm run judge:smoke
```

### Devpost Built With (manual)

Edit Devpost submission → Built With:

- **Remove:** `langchain`, `python`
- **Keep/add:** ClickHouse, mcp-clickhouse, Google Gemini API / `@google/genai`, MCP, TypeScript, React, Vite, Docker, Render

---

## Cold start

| Attempt | Endpoint | HTTP | Latency | Notes |
|---------|----------|------|---------|-------|
| 1 | `/api/v1/health` | **502** | ~14s | Service waking |
| 1 | `/api/v1/catalog/stats` | **503** | ~27s | `{"error":"API is still initializing. Retry in a few seconds."}` |
| — | wait | — | **60s** | Pre-warm pause |
| 2 | `/api/v1/health` | **200** | <1s | `ready: true` |
| 2 | `/api/v1/catalog/stats` | **200** | ~26s | `totalEntries: 200` |
| 1 | `/api/v1/greenlight?refresh=1` | **200** | ~36s | 3 picks, TypeScript scorer; Gemini memo timeout → fallback |

**Cold start total:** ~74s (14s failed health + 60s wait + ready)

---

## 1. Health

```bash
curl -sS --max-time 120 https://catalog-greenlight.onrender.com/api/v1/health
```

```json
{"status":"ok","product":"Catalog Greenlight","ready":true,"error":null,"timestamp":"2026-09-04T04:56:50.346Z","partners":{"clickhouse":"connected","mcp":"mcp-clickhouse","gemini":"gemini-2.0-flash"}}
```

| Check | Result |
|-------|--------|
| HTTP 200 | PASS |
| `ready: true` | PASS |

---

## 2. Catalog stats (~200 titles)

```bash
curl -sS --max-time 120 https://catalog-greenlight.onrender.com/api/v1/catalog/stats
```

```json
{"totalEntries":200,"genres":{"Comedy":52,"Drama":39,"Documentary":22,"Action":18,"Romance":16,"Thriller":15,"Sci-Fi":14,"Horror":14,"Animation":10},"recentAdditions":200,"topCast":[{"name":"Actor B","count":190},{"name":"Actor A","count":190},{"name":"Actor","count":7},{"name":"Host","count":2},{"name":"Gael García Bernal","count":1}],"latestRevenue":{"totalViews":8580304,"totalRevenueUsd":63217.40000000001,"topTitle":"Crimen sin Fronteras: Bogotá"}}
```

> Post-deploy: `topCast` must not list `Actor A` / `Actor B` (filtered in `McpCatalogRepository`).

| Check | Result |
|-------|--------|
| ~200 titles | PASS |
| Revenue non-zero | PASS |

---

## 3. Greenlight (`?refresh=1`)

```bash
curl -sS --max-time 180 'https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1'
```

**Pre-fix 2026-09-04:** picks included **Fading Line 75**; SYNTHESIZE timed out at 10s.

**Target post-fix:** 3 story titles (e.g. Bogotá / Archive / Harbor Letters), 3 genres, scores numeric, `SYNTHESIZE.fallback !== true` on warm path when Gemini quota OK.

**Garbage title check:** none of `Catalog Extra*`, `Fading Line*`, `Chronicle of Dream*`, `Scorer pick:`, or empty.

---

## 4. Ask (judge chip) — no 429

```bash
curl -sS --max-time 240 -X POST https://catalog-greenlight.onrender.com/api/v1/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Which genre is under-represented in our catalog?"}'
```

**Verified 2026-09-04T04:57:Z** — HTTP **200**. Body key is `question` (not `prompt`).

| Field | Value |
|-------|--------|
| `intent` | `catalog_qa` |
| Answer | Documentary is the most underserved slice: `gap_score` 0.074 |
| SQL | `D_slate_holes` CTE with `gap_score` |
| Recs | Documentary 0.074, Thriller 0.069 |

---

## 5–7. SPA / Playwright / judge scripts

Unchanged acceptance from prior smoke: `/`, `/ask`, `/catalog`, `/ingest`, `/judge`, `/guia` render; `npm run judge:smoke` + `npm run keepalive:smoke` documented above.

---

## 8. Summary

| Category | Hosted ready? |
|----------|---------------|
| Health endpoint | **YES** |
| Stats (~200 titles) | **YES** |
| Greenlight 3 picks + scores (anti-filler) | **CODE READY** — deploy + reseed required |
| SYNTHESIZE Gemini memo (25s / slim prompt) | **CODE READY** — verify warm post-deploy |
| Ask `/agent/ask` under-represented | **YES** — Documentary `gap_score` 0.074 |
| Keepalive cron script | **YES** — `BASE_URL=… bash scripts/keepalive-smoke.sh` |
| Devpost Built With cleanup | **MANUAL** — remove langchain/python |

**Video verdict (pre-deploy):** **NO LISTO** hasta Render deploy + `seed-remote.sh` + re-smoke `?refresh=1` sin fillers y SYNTHESIZE sin fallback.
