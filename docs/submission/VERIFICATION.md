# Submission verification log

**Product:** Catalog Greenlight  
**Public repo:** https://github.com/armandobecerraro/catalog-greenlight  
**Verified:** 2026-08-27  
**Commit under test:** `678b754`

---

## 1. Clone-clean build pipeline

```bash
npm install
npm run build
npm test
```

| Step | Status | Notes |
|------|--------|-------|
| `npm install` | PASS | workspaces: core, infrastructure, orchestration, api, web, examples |
| `npm run build` | PASS | all packages |
| `npm test` | PASS | core (12), infrastructure (8), orchestration (4) |

---

## 2. Compliance greps (product path)

| Check | Status |
|-------|--------|
| No LangChain in product | PASS |
| FakeGemini not in api/demo/web | PASS (tests only) |
| No `@clickhouse/client` in packages | PASS |
| `@modelcontextprotocol/sdk` | PASS — `McpClickHouseConnector.ts` |
| `@google/genai` + `generateContent` | PASS — `generateContent.ts`, adapters |
| `callTool` + `run_query` | PASS |
| SQL guard | PASS — `sqlValidation.ts` + unit tests |

---

## 3. ClickHouse data

| Source | Status | Notes |
|--------|--------|-------|
| ClickHouse Cloud (submission path) | PASS | ~50+ titles in `media_catalog.media_content`; revenue in `title_revenue` |
| Local Docker seed | PASS | `deployment/scripts/seed.sh` → 50 titles (Path B / `npm run demo`) |

---

## 4. MCP runtime smoke

```bash
npm run smoke:mcp --workspace=@bas/infrastructure
```

| Tool | Status |
|------|--------|
| `list_databases` | PASS |
| `list_tables` | PASS |
| `run_query` | PASS |

---

## 5. Gemini + agent runtime (local with `.env`)

| Step | Status | Notes |
|------|--------|-------|
| `GEMINI_API_KEY` in local `.env` | PASS | not committed |
| Ingest via API/UI | PASS | Gemini enrichment + MCP INSERT |
| `/ask` 6-step pipeline | PASS | SQL + row evidence + numeric answer |
| Greenlight | PASS | 3 recommendations; first load ~1–3 min on Cloud |

---

## 6. Repository (public GitHub)

| Item | Status |
|------|--------|
| Public URL | **PASS** — https://github.com/armandobecerraro/catalog-greenlight |
| License | MIT |
| Remote `origin` | configured |
| Push | pending this commit (`git push origin main`) |

---

## 7. Hosted demo URL

| Item | Status |
|------|--------|
| `Dockerfile` + `render.yaml` | PASS — bookworm + uv + mcp-clickhouse smoke in image build |
| Live public URL | **NOT DEPLOYED** — no GCP credits / manual Cloud Run step; judges use `npm run dev` |
| `DEVPOST.md` hosted field | `TODO_HOSTED_URL` |

---

## 8. UI / browser E2E

| Route | Status | Evidence |
|-------|--------|----------|
| `/` Dashboard | PASS | Playwright + stats > 0 |
| `/catalog` | PASS | Playwright >10 rows |
| `/ingest` | PASS | Playwright ingest → catalog row |
| `/ask` | PASS | Playwright 6 steps + SQL + Evidence |
| Mobile 390px | PASS | Playwright four routes |

Full log: `docs/submission/DEV_VERIFY.md` + `docs/submission/playwright-output.txt`

---

## 9. Agent 6-step pipeline

`AgentRunner.ts`: INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT  
Unit test: `AgentRunner.test.ts` — PASS

---

## Summary

| Category | Ready for Devpost? |
|----------|-------------------|
| Code + tests + MCP smoke | **YES** |
| Public GitHub | **YES** |
| Browser E2E (Playwright) | **YES** |
| Hosted URL | **NO** (honest — local demo) |
| YouTube video | **NO** (`TODO_YOUTUBE`) |
| ADK TypeScript | **NO** (next pass) |
