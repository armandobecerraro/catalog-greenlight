# Submission verification log

**Product:** Catalog Greenlight  
**Repo path:** `/Users/armandobecerrarodriguez/Proyectos/blockbuster-agentic-studio`  
**Verified:** 2026-08-26 (local agent run)  
**Commit under test:** pending (hygiene + MCP parse fixes)

---

## 1. Clone-clean build pipeline

```bash
npm install
npm run build
npm test
```

### Results

| Step | Status | Notes |
|------|--------|-------|
| `npm install` | PASS | 670 packages audited |
| `npm run build` | PASS | core, infrastructure, orchestration, web, api, examples |
| `npm test` | PASS | 23 tests across core (12), infrastructure (8), orchestration (4) |

---

## 2. Compliance greps (product path)

```bash
# LangChain / banned AI SDKs
rg -l "langchain|@langchain|openai|anthropic" --glob '!node_modules' --glob '!package-lock.json' --glob '!*.md' .
# → CLEAN

# FakeGemini in api / web / examples
rg "FakeGeminiEnrichmentClient" packages/api packages/web examples
# → CLEAN (tests only: packages/infrastructure/tests)

# Direct ClickHouse Node client (removed)
rg "@clickhouse/client" packages --glob '!node_modules'
# → CLEAN (removed from package.json)

# Legacy ClickHouseConnector class (removed)
rg "class ClickHouseConnector" packages
# → CLEAN
```

| Check | Status |
|-------|--------|
| No LangChain in product | PASS |
| FakeGemini not in api/demo/web | PASS |
| No `@clickhouse/client` dependency | PASS |
| `@modelcontextprotocol/sdk` in infrastructure | PASS |
| `GoogleGenerativeAI` + `generateContent` | PASS — `GeminiEnrichmentAdapter.ts`, `GeminiReasoningAdapter.ts` |
| `callTool` + `run_query` | PASS — `McpClickHouseConnector.ts` |
| Default ClickHouse port 8123 | PASS — `buildClickHouseConfig()` |
| SQL guard (no DROP on Q&A) | PASS — `packages/core/src/utils/sqlValidation.ts` + unit tests |

---

## 3. ClickHouse seed (Docker)

```bash
docker compose -f deployment/docker/docker-compose.clickhouse.yml up -d clickhouse
bash deployment/scripts/seed.sh
docker compose ... clickhouse-client --query "SELECT count() FROM media_catalog.media_content"
```

**Output:** `50`

---

## 4. MCP runtime smoke (official mcp-clickhouse)

```bash
npm run smoke:mcp --workspace=@bas/infrastructure
```

**Output (2026-08-26):**

```
list_databases: [ 'INFORMATION_SCHEMA', 'default', 'information_schema', 'media_catalog', 'system' ]
list_tables(media_catalog): [ 'agent_runs', 'media_content', 'title_revenue' ]
run_query result: [ { titles: 50 } ]
latency_ms: ~53–169
MCP smoke test PASSED
```

Tools exercised: `list_databases`, `list_tables`, `run_query` via `@modelcontextprotocol/sdk` `Client.callTool`.

---

## 5. Gemini full-stack runtime

```bash
export GEMINI_API_KEY=<required>
npm run demo          # ingest + stats + NL question + greenlight
npm run dev           # API :8080 + web :5173
curl http://localhost:8080/api/v1/health
curl http://localhost:8080/api/v1/greenlight
```

| Step | Status | Notes |
|------|--------|-------|
| `GEMINI_API_KEY` present in CI agent env | **BLOCKED** | Not available in verification shell — API init correctly requires key |
| `npm run demo` with real Gemini | **PENDING** | Run locally after `export GEMINI_API_KEY=...` |
| UI `/ask` timeline + SQL evidence | **PENDING** | Requires API running with Gemini |

Code path verified by static analysis + unit tests; live Gemini call blocked only by missing secret in this environment.

---

## 6. Repository (public GitHub)

| Item | Status |
|------|--------|
| Local git repo | PASS — branch `main`, initial commit `96cec91` |
| Remote configured | **BLOCKED** — `gh auth status` reports invalid token for `armandobecerraro` |
| Public GitHub URL | **NOT CREATED** — requires `gh auth login` then `gh repo create catalog-greenlight --public --source=. --push` |

---

## 7. Hosted demo URL

| Item | Status |
|------|--------|
| `render.yaml` + `Dockerfile` | PASS — ready to deploy |
| Live public URL | **NOT DEPLOYED** — needs GitHub remote + Render/Cloud Run + `GEMINI_API_KEY` + ClickHouse Cloud host |

See `docs/submission/DEPLOY.md`.

---

## 8. UI surfaces (code present)

| Route | File | Status |
|-------|------|--------|
| `/` Dashboard + Greenlight | `packages/web/src/pages/Dashboard.tsx` | Implemented |
| `/catalog` | `packages/web/src/pages/Catalog.tsx` | Implemented |
| `/ingest` | `packages/web/src/pages/Ingest.tsx` | Implemented |
| `/ask` + 6-step timeline | `packages/web/src/pages/Ask.tsx` | Implemented |

---

## 9. Agent 6-step pipeline

`packages/orchestration/src/agents/AgentRunner.ts`:

INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT

Unit test: `packages/orchestration/tests/unit/AgentRunner.test.ts` — PASS

---

## Summary

| Category | Ready for Devpost? |
|----------|-------------------|
| Code + tests + MCP smoke | **YES** |
| Gemini E2E in this environment | **NO** (missing API key) |
| Public GitHub repo | **NO** (gh auth expired) |
| Hosted URL | **NO** (not deployed) |

**Next automated step after secrets restored:**

```bash
gh auth login
gh repo create catalog-greenlight --public --source=. --remote=origin --push
# Deploy on Render from render.yaml; paste URL into docs/submission/DEVPOST.md
export GEMINI_API_KEY=...
npm run demo && npm run dev
```
