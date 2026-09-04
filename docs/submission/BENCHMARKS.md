# Hosted benchmarks — Catalog Greenlight

**URL:** https://catalog-greenlight.onrender.com  
**Measured:** 2026-09-03 (America/Bogota) · Render free tier · ClickHouse Cloud  
**Method:** `curl` from developer machine against live hosted API (warm service unless noted).

These numbers are **honest** samples, not synthetic marketing. Latency includes MCP stdio + ClickHouse Cloud round-trips on a single Render instance.

## Summary (warm service)

| Endpoint | n | p50 | p95 | Notes |
|----------|---|-----|-----|-------|
| `GET /api/v1/health` | 5 | **<1 s** | **<1 s** | `ready: true`, partners connected |
| `GET /api/v1/catalog/stats` | 3 | **~28 s** | **~30 s** | ~200 titles, genre mix |
| `GET /api/v1/greenlight` (cached) | 3 | **~11 s** | **~12 s** | 10 min server cache |
| `GET /api/v1/greenlight?refresh=1` | 3 | **~37 s** | **~43 s** | 4 parallel MCP SELECTs + TS scorer + Gemini (25s cap) |
| `POST /api/v1/agent/ask` (judge chip) | 3 | **~33 s** | **~46 s** | 6-step agent; `fallback: true` when Gemini planner slow |

## Cold start (Render spin-down)

| Phase | Typical latency |
|-------|-----------------|
| First request after idle | **502/503** or slow wake |
| Health `ready: true` | **60–90 s** total |
| First greenlight after wake | **+30–40 s** on top |

**Mitigation:** `bash scripts/keepalive-smoke.sh` or UptimeRobot / cron every 5–10 min on `/api/v1/health` only.

```cron
# Example: every 7 minutes (UTC) — health keep-alive during judging week
*/7 * * * * BASE_URL=https://catalog-greenlight.onrender.com bash /path/to/catalog-greenlight/scripts/keepalive-smoke.sh >>/tmp/cg-keepalive.log 2>&1
```

Do **not** schedule `greenlight?refresh=1` on a timer (wastes ClickHouse + Gemini quota).

## Greenlight correctness (post diversity fix)

Verified on live `?refresh=1`:

| Check | Result |
|-------|--------|
| 3 recommendations | PASS |
| 3 unique genres | PASS (e.g. Thriller / Documentary / Drama) |
| Numeric `opportunity_score` | PASS |
| Titles grounded in `/api/v1/catalog` | PASS |
| Gemini SYNTHESIZE timeout | Acceptable — scorer picks still HTTP 200 |

## Reproduce locally

```bash
# Health
curl -sS --max-time 120 https://catalog-greenlight.onrender.com/api/v1/health

# Timed greenlight refresh (warm)
/usr/bin/time curl -sS --max-time 240 \
  'https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1' \
  -o /dev/null

# Full smoke with assertions
BASE_URL=https://catalog-greenlight.onrender.com bash scripts/keepalive-smoke.sh
```

## Risks during judging window

| Risk | Mitigation |
|------|------------|
| Render free tier sleep | Keep-alive on `/health` |
| ClickHouse Cloud trial credits | Extended through Oct 2026 per submission docs |
| Gemini 429 on `/ask` + `/ingest` | Greenlight still scores from ClickHouse without Gemini |
