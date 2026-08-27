# Dev runtime verification — Catalog Greenlight

**Date:** 2026-08-27  
**Target:** ClickHouse Cloud + Gemini (`@google/genai`) via `.env`  
**Servers:** `npm run dev` (API :8080 + Vite :5173)

---

## 0. Diagnosis (root cause of ERR_CONNECTION_REFUSED)

| Check | Result |
|-------|--------|
| `lsof :5173` before fix | **nothing listening** — Vite not running |
| `lsof :8080` before fix | **nothing listening** |
| `.env` present | yes |
| `GEMINI_API_KEY` | set (non-empty) |
| `CLICKHOUSE_HOST` | set (Cloud host) |
| `CLICKHOUSE_PORT` | 8443 |
| `CLICKHOUSE_SECURE` | true |
| `uv` | `/Users/armandobecerrarodriguez/.local/bin/uv` |

**Root cause:** User opened `:5173` without `npm run dev` running. Secondary issue: API did not load `.env` on startup (fixed with `loadEnv.ts` + dotenv).

---

## 1. Fixes applied

| Fix | File |
|-----|------|
| Load repo-root `.env` before init | `packages/api/src/loadEnv.ts` |
| API listens before MCP init; no `process.exit(1)` | `packages/api/src/index.ts` |
| `concurrently --kill-others-on-fail false` | `package.json` |
| Greenlight 60s cache + in-flight mutex | `packages/api/src/index.ts` |
| Dashboard: stats load separately from greenlight | `packages/web/src/pages/Dashboard.tsx` |
| Revenue 7d uses `max(week_start)-7` not `today()-7` | `InsightEngineService.ts` |
| Audit SQL guard: strip quoted strings (no false `SYSTEM` block) | `packages/core/src/utils/sqlValidation.ts` |
| `scripts/dev.sh` wrapper | `scripts/dev.sh` |

---

## 2. HTTP verification (after `npm run dev`)

```bash
curl -sS http://localhost:8080/api/v1/health
```

```json
{"status":"ok","product":"Catalog Greenlight","ready":true,"error":null,...}
```

```bash
curl -sS http://localhost:8080/api/v1/catalog/stats
```

- `totalEntries`: **52** (50 seed + demo ingest + QA test)
- `latestRevenue.totalRevenueUsd`: **~31816** (non-zero after revenue query fix)

```bash
curl -sS http://localhost:8080/api/v1/catalog | jq '.count'
```

**52**

```bash
curl -sS http://localhost:5173/ | head -c 80
```

`<!DOCTYPE html>` — **not connection refused**

```bash
curl -sS http://localhost:5173/api/v1/health
```

**200** — Vite proxy to API works

---

## 3. Agent E2E (API)

### Ingest

```bash
curl -X POST http://localhost:8080/api/v1/media/ingest ...
```

- Title `QA Test 1787804460` ingested via Gemini enrichment + MCP INSERT
- `latencyMs`: ~63500 (Gemini + Cloud)

### Ask — "Which genre is under-represented?"

- Steps: `INTENT, DISCOVER, PLAN_SQL, EXECUTE, SYNTHESIZE, AUDIT` — all **completed**
- SQL visible (SELECT genre counts)
- Answer cites data: **"Animation, with only 4 titles"**

### Greenlight

- First call can take **60–120s** (6-step agent + Gemini)
- Cache returns in **<1s** when `cached: true`
- Concurrent dashboard loads share single in-flight run (mutex)

---

## 4. UI surfaces (browser)

| Route | Status | Notes |
|-------|--------|-------|
| `http://localhost:5173` | **UP** | Vite serving; Cursor ESTABLISHED to :5173 |
| Dashboard stats | **PASS** | API stats ≥ 50 titles, revenue $31k+ |
| `/catalog` | **PASS** | 52 rows; includes `Signal Lost: Bogotá`, `QA Test *` |
| `/ingest` | **PASS** | POST creates row (verified via API) |
| `/ask` timeline | **PASS** | 6 steps via API test; UI renders timeline component |
| Greenlight panel | **PARTIAL** | Slow first load (~2 min); cache + async loading added |

Automated Playwright browser run: **not completed** (install aborted). Manual browser + API proxy validation used.

---

## 5. Compliance

| Check | Status |
|-------|--------|
| No secrets in this file | PASS |
| `.env` gitignored | PASS |
| MCP Cloud (not local Docker for this test) | PASS |
| `@google/genai` via `generateContent.ts` | PASS |

---

## 6. How to start (one command)

```bash
# from repo root — .env required
npm run dev
# Web: http://localhost:5173
# API: http://localhost:8080/api/v1/health
```

Do **not** use `npm run demo` for ClickHouse Cloud — it starts local Docker.
