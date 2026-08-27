# Dev runtime verification — Catalog Greenlight

**Date:** 2026-08-27  
**Target:** ClickHouse Cloud (HTTPS 8443) + Gemini (`@google/genai`) via repo-root `.env`  
**Repo:** https://github.com/armandobecerraro/catalog-greenlight  
**Commit:** `678b754`

---

## 1. Servers

```bash
PATH="$HOME/.local/bin:$PATH" npm run dev
```

| Check | Result |
|-------|--------|
| `curl http://localhost:8080/api/v1/health` | `ready: true` |
| `curl http://localhost:5173/` | HTML (no `ERR_CONNECTION_REFUSED`) |
| Vite proxy `/api/v1/health` | 200 |

---

## 2. Playwright E2E (browser, real UI)

**Spec:** `packages/web/e2e/hackathon.spec.ts`  
**Command:** `npm run test:e2e` (with `npm run dev` running)  
**Viewports:** 1280×800 and 390×844

**Output (2026-08-27):** see `docs/submission/playwright-output.txt`

```
Running 6 tests using 1 worker
  ✓ catalog: dozens of rows
  ✓ ingest: unique title appears in catalog
  ✓ ask: 6 completed steps, SQL, and numeric answer
  ✓ dashboard: stats load immediately
  ✓ dashboard: greenlight panel resolves (may take 1–2 min)
  ✓ all four routes load without connection errors (390 mobile)

  6 passed (2.2m)
```

| Route | Verified |
|-------|----------|
| `/` Dashboard stats | PASS — catalog count > 0, revenue visible |
| `/` Greenlight | PASS — 3 rec-cards or answer within 240s timeout |
| `/catalog` | PASS — >10 table rows |
| `/ingest` | PASS — unique title + cast; success banner; row in catalog UI |
| `/ask` | PASS — 6 `status-completed` steps, SQL block, Evidence rows, answer with digits |

**Not used for PASS:** screenshots alone, curl-only ingest/ask without UI.

---

## 3. Runtime fixes in this pass

| Area | Change |
|------|--------|
| Greenlight timeout | 240s; generation counter invalidates stale runs (no cache update after timeout); mutex released in `finally` |
| Frontend fetch | `AbortController` 240s on ask/greenlight/ingest (`packages/web/src/api.ts`) |
| `.env` loading | `loadRepoEnv()` walks up from `src/` or `dist/` (`packages/infrastructure/src/loadEnv.ts`) |
| CLI demos | `loadRepoEnv()` in `insight-engine-demo.ts` + `content-ingestion.ts` |
| Gemini models | Removed deprecated `gemini-2.5-flash-lite`; skip unavailable models in fallback chain |
| Dockerfile | `node:20-bookworm-slim` + uv + `uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse --help` smoke |

---

## 4. Compliance

| Check | Status |
|-------|--------|
| No secrets in this file | PASS |
| `@google/genai` in `generateContent.ts` | PASS |
| mcp-clickhouse `callTool` / `run_query` | PASS |
| No LangChain / FakeGemini in api/web/demo | PASS |

---

## 5. How to reproduce

```bash
git clone https://github.com/armandobecerraro/catalog-greenlight
cd catalog-greenlight
cp .env.example .env   # GEMINI_API_KEY + ClickHouse Cloud 8443 SECURE=true
npm install
PATH="$HOME/.local/bin:$PATH" npm run dev
# separate terminal:
npm run test:e2e
```

Do **not** use `npm run demo` for ClickHouse Cloud — it starts local Docker.
