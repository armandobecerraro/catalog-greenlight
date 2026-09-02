# Hosted smoke verification — Catalog Greenlight

**URL:** https://catalog-greenlight.onrender.com  
**Verified:** 2026-09-02T15:30:16Z  
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

## 4. Summary

| Category | Hosted ready? |
|----------|---------------|
| Health endpoint | **YES** |
| Stats (~200 titles) | **YES** |
| Greenlight 3 picks + scores | **YES** (TypeScript scorer; Gemini memo timed out → fallback) |
| Cold start tolerance | **YES** (~74s with 60s pre-warm) |
