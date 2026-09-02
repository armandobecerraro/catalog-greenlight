# Hosted smoke verification — Catalog Greenlight

**URL:** https://catalog-greenlight.onrender.com  
**Verified:** 2026-09-02T20:10:00Z (Ask + Playwright re-run after GCP Gemini coupon)  
**Platform:** Render (free tier — cold start 60–90s pre-warm after spin-down)

> **Keep-alive (opcional):** UptimeRobot o cron cada 5 min contra `/api/v1/health` evita spin-down; no requiere provisioning ni pago en tier free.

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
{"status":"ok","product":"Catalog Greenlight","ready":true,"error":null,"timestamp":"2026-09-02T15:29:26.394Z","partners":{"clickhouse":"connected","mcp":"mcp-clickhouse","gemini":"gemini-2.0-flash"}}
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

| Check | Result |
|-------|--------|
| HTTP 200 | PASS |
| `totalEntries` ≈ 200 | PASS (200) |

---

## 3. Greenlight (`?refresh=1`)

```bash
curl -sS --max-time 240 "https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1"
```

**Truncated response** (full payload ~67 KB; omitted `sql`, `steps[].output.fullById`, query row dumps):

```json
{
  "runId": "b21c707b-b6c7-46fc-9397-d89246804994",
  "intent": "greenlight",
  "answer": "Weekly greenlight from measured ClickHouse analytics. TypeScript scored the slate; Gemini memo is optional.",
  "cached": false,
  "totalLatencyMs": 34776,
  "model": "gemini-2.0-flash",
  "recommendations": [
    {
      "title": "Crimen sin Fronteras: Bogotá",
      "genre": "Thriller",
      "opportunity_score": 0.268,
      "wow_pct": 0.32,
      "genre_gap": 0.135,
      "in_cannibal_pair": false
    },
    {
      "title": "Archive: Road 114",
      "genre": "Documentary",
      "opportunity_score": 0.21,
      "wow_pct": 0.021,
      "genre_gap": 0.139,
      "in_cannibal_pair": false
    },
    {
      "title": "Archive: City 102",
      "genre": "Documentary",
      "opportunity_score": 0.173,
      "wow_pct": -0.162,
      "genre_gap": 0.139,
      "in_cannibal_pair": false
    }
  ],
  "steps_summary": {
    "SYNTHESIZE": {
      "fallback": true,
      "geminiError": "Gemini synthesis timed out after 10s"
    }
  }
}
```

**Recommendation object keys (real):** `title`, `genre`, `justification`, `evidence`, `opportunity_score`, `wow_pct`, `genre_gap`, `in_cannibal_pair`

| Check | Result |
|-------|--------|
| HTTP 200 | PASS |
| 3 recommendations | PASS |
| Numeric `opportunity_score` on each | PASS (0.268, 0.21, 0.173) |
| No garbage titles | PASS |
| Gemini on greenlight | **timeout** (fallback; picks + metrics OK) |

**Garbage title check:** none of `Catalog Extra*`, `Fading Line 75`, `Chronicle of Dream <n>`, `Scorer pick:`, or empty.

---

## 4. Ask (judge chip) — no 429

```bash
curl -sS --max-time 240 -X POST https://catalog-greenlight.onrender.com/api/v1/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Which genre is under-represented in our catalog?"}'
```

**Verified 2026-09-02T20:09:05Z** — HTTP **200** in ~34s. No `429` / `gemini_billing`.

| Field | Value |
|-------|--------|
| `intent` | `catalog_qa` |
| `model` | `gemini-2.0-flash` |
| `fallback` | `true` (planner+writer used deterministic MCP SQL after ~10s Gemini wait) |
| `queryRows` | 11 |
| 6-step timeline | INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT, all `completed` |
| Answer | Documentary is the most underserved slice: `gap_score` 0.074 (revenue share minus title share). Measured in ClickHouse via mcp-clickhouse. |
| SQL | `D_slate_holes` (`WITH latest AS … gap_score`) via `mcp-clickhouse` `run_query` |
| Recs | Documentary 0.074, Thriller 0.069, language `es` 0.013 |

Gemini **credits are live** (no billing 429). PLAN_SQL/SYNTHESIZE still fall back if Gemini exceeds ~10s; ClickHouse evidence still returns.

**Ad-hoc prompts (after ask grounding fix):** comedy recommend → Comedy titles SQL (`mc.genre = 'Comedy'`); duration is **not** a `media_content` column so the answer must say so instead of pivoting to Animation inventory. “Which genre should we greenlight next based on recent revenue?” → `D_slate_holes` / `gap_score`, not the fewest-titles line.

**Re-smoke after deploy:**

```bash
curl -sS --max-time 240 -X POST https://catalog-greenlight.onrender.com/api/v1/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Recommend a feel-good comedy under 2 hours"}'
# expect HTTP 200, SQL with genre = 'Comedy', answer cites comedy titles (and says duration is not in schema)

curl -sS --max-time 240 -X POST https://catalog-greenlight.onrender.com/api/v1/agent/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"Which genre should we greenlight next based on recent revenue?"}'
# expect HTTP 200, distinct answer (gap_score / recent revenue), not the Animation fewest-titles line

curl -sS --max-time 180 'https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1'
# expect HTTP 200 and 3 recommendations
```

---

## 5. Playwright hosted smoke

```bash
npm run test:e2e:hosted
```

**2026-09-02T20:10Z — 4/4 passed** against https://catalog-greenlight.onrender.com (~9s, service already warm): health ready, stats ~200, greenlight 3 catalog-grounded picks, dashboard 3 rec-cards.

---

## 6. Summary

| Category | Hosted ready? |
|----------|---------------|
| Health endpoint | **YES** |
| Stats (~200 titles) | **YES** |
| Greenlight 3 picks + scores | **YES** (TypeScript scorer; Gemini memo timed out → fallback) |
| Ask `/agent/ask` | **YES** — HTTP 200, no 429, SQL + 11 ClickHouse rows, 6 steps |
| Playwright hosted | **YES** — 4/4 |
| Cold start tolerance | **YES** (~74s with 60s pre-warm) |
