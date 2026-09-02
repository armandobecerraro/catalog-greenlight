# Jury evidence brief — Catalog Greenlight (facts only, no secrets)

**Public GitHub:** https://github.com/armandobecerraro/catalog-greenlight  
**Commit inspected:** `8840175` (HEAD; Render URL documented in `545ce31`)  
**Track:** ClickHouse (official `mcp-clickhouse` required)  
**Product:** Web app for a streaming **programming chief** — catalog stats, ingest, NL Q&A, weekly greenlight picks.

---

## Stage One checklist (official rules)

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Public hosted web URL | **PASS** | https://catalog-greenlight.onrender.com — `GET /api/v1/health` → `ready: true` (verified 2026-09-01). Also in `docs/submission/DEVPOST.md`. |
| Video ≤3 min EN (YouTube/Vimeo), product working | **PENDING** | `DEVPOST.md` line 38: `TODO_YOUTUBE`. No YouTube/Vimeo link yet. |
| Public repo + OSI license visible | **PASS** | GitHub URL above. Root `LICENSE` = MIT. |
| Google Cloud AI imported AND called at runtime | **PASS** | `@google/genai` in `packages/infrastructure/package.json`. `generateContent.ts`: `GoogleGenAI`, `ai.models.generateContent`. Adapters: `GeminiEnrichmentAdapter.ts`, `GeminiReasoningAdapter.ts`. |
| ClickHouse via official MCP `mcp-clickhouse` at runtime | **PASS** | `McpClickHouseConnector.ts`: spawns `uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse`; `Client.callTool` → `run_query`, `list_databases`, `list_tables`. No `@clickhouse/client` in `packages/*/package.json`. |
| Web / mobile platform | **PASS** | React + Vite UI: `packages/web` — routes `/`, `/catalog`, `/ingest`, `/ask`. |
| New project in contest period | **UNKNOWN** (not verified in repo) | Assumed hackathon build; no creation date in LICENSE (copyright 2025). |
| No LangChain / OpenAI / Anthropic in runtime | **PASS** | Grep `langchain|openai|anthropic` in `packages/**/*.ts` → no matches in product code. |
| Devpost form + ClickHouse track | **PENDING** | Hosted URL ready; video (`TODO_YOUTUBE`) and Devpost form submission still outstanding. |

---

## Compliance greps (2026-09-01)

```
@google/genai / GoogleGenAI / generateContent
  → packages/infrastructure/src/gemini/generateContent.ts (lines 1, 33, 40)
  → GeminiEnrichmentAdapter.ts, GeminiReasoningAdapter.ts import generateGeminiText

@google/adk / LlmAgent
  → NOT FOUND in packages/ or examples/

@modelcontextprotocol/sdk callTool run_query
  → McpClickHouseConnector.ts lines 57-58, 120-124

FakeGeminiEnrichmentClient
  → packages/infrastructure/src/gemini/FakeGeminiEnrichmentClient.ts
  → packages/infrastructure/tests/unit/FakeGeminiEnrichmentClient.test.ts ONLY
  → NOT imported in packages/api, packages/web, examples/media-workflows

langchain / @langchain
  → CLEAN in packages/**/*.ts

@clickhouse/client
  → NOT in any packages/*/package.json (removed from product path)
```

---

## Agent architecture

**6-step pipeline** (`packages/orchestration/src/agents/AgentRunner.ts`):

INTENT → DISCOVER (MCP list_*) → PLAN_SQL (Gemini) → EXECUTE (MCP run_query) → SYNTHESIZE (Gemini) → AUDIT (INSERT agent_runs)

- SQL guard: `packages/core/src/utils/sqlValidation.ts` — blocks DROP/ALTER/TRUNCATE etc.; allows INSERT for ingest/audit.
- AUDIT step builds INSERT with string concat + `escapeSql()` in AgentRunner (lines 64-78) — injection risk if prompts contain quotes.
- UI timeline: `packages/web/src/components/Layout.tsx` `AgentTimeline`; `/ask` page shows SQL block + Evidence JSON.

**Greenlight** (`packages/api/src/index.ts`):

- Cache 60s, mutex `greenlightInFlight`, timeout 240s with `greenlightRunGeneration` to invalidate stale runs (no Promise.race orphan cache update).
- Frontend fetch abort 240s: `packages/web/src/api.ts` `AGENT_FETCH_TIMEOUT_MS`.

**Not ADK / not Vertex function calling:** custom `AgentRunner` + prompt-based Gemini adapters.

---

## ClickHouse schema & data

**Schema** (`deployment/docker/init-schema.sql`):

- `media_content` — MergeTree ORDER BY (id)
- `title_revenue` — MergeTree ORDER BY (week_start, title_id)
- `agent_runs` — MergeTree ORDER BY (created_at, id)

**Seed:** `deployment/scripts/generate-seed-catalog.mjs` + `seed-catalog.sql` — **200 titles**, 10 weeks revenue (local Docker and ClickHouse Cloud submission path).  
**Submission path:** ClickHouse Cloud HTTPS **8443**, `CLICKHOUSE_SECURE=true` (README Path A; `.env` not in repo).

**Stats query** (`InsightEngineService.ts` ~162-170): revenue 7d uses `week_start >= (SELECT max(week_start) - 7 FROM title_revenue)` not `today()-7`.

**Runtime stats (curl 2026-09-01, Render hosted):**

- `GET https://catalog-greenlight.onrender.com/api/v1/health` → `ready: true`
- `GET https://catalog-greenlight.onrender.com/api/v1/catalog/stats` → `totalEntries: 200`, genres distribution, `latestRevenue` non-zero (~8.6M views)

---

## MCP connector

`McpClickHouseConnector.ts`:

- Stdio transport via `uv` + `mcp-clickhouse`
- Env: CLICKHOUSE_HOST, PORT, SECURE, ALLOW_WRITE_ACCESS
- `parseMcpResult` parses MCP content to rows

`ConnectorFactory.ts` / `buildClickHouseConfig()` — default port **8123** in code when env unset; README documents 8443 for Cloud.

---

## UI surfaces

| Route | File | Behavior |
|-------|------|----------|
| `/` | `Dashboard.tsx` | Stats + greenlight in parallel; greenlight can take 1–3 min |
| `/catalog` | `Catalog.tsx` | Table + filter |
| `/ingest` | `Ingest.tsx` | Form; requires cast (validation) |
| `/ask` | `Ask.tsx` | NL question + timeline |

**Playwright E2E** (`packages/web/e2e/hackathon.spec.ts`, log `docs/submission/playwright-output.txt`):

- 6/6 passed (2026-08-27): catalog >10 rows, ingest unique title → catalog, ask 6 completed steps + SQL + Evidence + digits in answer, dashboard stats, greenlight panel, mobile 390px four routes.
- Serial order: catalog → ingest → ask → dashboard (avoids greenlight blocking MCP during ingest/ask).

---

## Deployment / infra

- `Dockerfile`: `node:20-bookworm-slim`, installs `uv`, smoke `uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse --help`
- `render.yaml` — Render web service; live at https://catalog-greenlight.onrender.com
- **Docker build not verified** in last dev session (daemon not running)

**`.env` loading:** `packages/infrastructure/src/loadEnv.ts` — `loadRepoEnv()` walks up to repo root `.env`. Used by API + CLI demos.

---

## Tests

`npm test` (2026-08-27): PASS — core 12, infrastructure 8, orchestration 4 unit tests.  
`AgentRunner.test.ts` mocks MCP + reasoning, asserts 6 steps.

---

## README vs reality

| Claim | Match? |
|-------|--------|
| GitHub URL `armandobecerraro/catalog-greenlight` | YES |
| Path A: Cloud 8443 + `npm run dev` | YES in README |
| `@google/genai` not `@google/generative-ai` | YES in code |
| `gemini-flash-latest` default | YES `generateContent.ts`, `.env.example` |
| `.env.example` defaults localhost **8123** | YES — judges must edit for Cloud |
| Hosted demo | YES — https://catalog-greenlight.onrender.com |

---

## What is NOT demonstrated

- English ≤3 min video of working product (`TODO_YOUTUBE`)
- `@google/adk` / Agent Builder / Vertex ADK
- Grafana MCP (not used — correct for track)
- LangChain, OpenAI, Anthropic
- FakeGemini in production runtime path
- Statistical rigor beyond small catalog (~200 titles)
- Enterprise IAM / multi-tenant governance

---

## File index for quick judge navigation

| Topic | Path |
|-------|------|
| Gemini SDK | `packages/infrastructure/src/gemini/generateContent.ts` |
| MCP ClickHouse | `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts` |
| Agent | `packages/orchestration/src/agents/AgentRunner.ts` |
| API + greenlight | `packages/api/src/index.ts` |
| SQL guard | `packages/core/src/utils/sqlValidation.ts` |
| Web API client | `packages/web/src/api.ts` |
| E2E | `packages/web/e2e/hackathon.spec.ts` |
| Submission copy | `docs/submission/DEVPOST.md` |
