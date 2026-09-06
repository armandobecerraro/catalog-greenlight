# Jury evidence brief — Catalog Greenlight (facts only, no secrets)

**Public GitHub:** https://github.com/armandobecerraro/catalog-greenlight  
**Commit inspected:** `eef06480ab53021babce09821aaab22988fcb8bd` (`git rev-parse HEAD`, 2026-09-02)  
**Track:** ClickHouse (official `mcp-clickhouse` required)  
**Product:** Web app for a streaming **programming chief** — catalog stats, ingest, NL Q&A, weekly **catalog slate** greenlight (three picks).

**Pitch:** ClickHouse measures. TypeScript scores. Gemini explains.

**vs Chloe:** **Catalog Greenlight** = programming chief + weekly catalog slate + 4 MCP SELECTs + TypeScript scorer. **Chloe** (competing hackathon entry) = screenplay→film production — different user, output, and stack.

---

## Stage One checklist (official rules)

| Requirement                                             | Status      | Evidence                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public hosted web URL                                   | **PASS**    | https://catalog-greenlight.onrender.com — `GET /api/v1/health` → `ready: true` (verified 2026-09-01). Also in `docs/submission/DEVPOST.md`.                                                                              |
| Video ≤3 min EN (YouTube/Vimeo), product working        | **PASS**    | https://youtu.be/Q_MOBA7Thc4 (~2:43). Same URL on Devpost.                                                                                                                                                               |
| Public repo + OSI license visible                       | **PASS**    | GitHub URL above. Root `LICENSE` = MIT.                                                                                                                                                                                  |
| Google Cloud AI imported AND called at runtime          | **PASS**    | `@google/genai` in `packages/infrastructure/package.json`. `generateContent.ts`: `GoogleGenAI`, `ai.models.generateContent`. Adapters: `GeminiEnrichmentAdapter.ts`, `GeminiReasoningAdapter.ts`.                        |
| ClickHouse via official MCP `mcp-clickhouse` at runtime | **PASS**    | `McpClickHouseConnector.ts`: spawns `uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse`; `Client.callTool` → `run_query`, `list_databases`, `list_tables`. No `@clickhouse/client` in `packages/*/package.json`. |
| Web / mobile platform                                   | **PASS**    | React + Vite UI: `packages/web` — routes `/`, `/judge`, `/catalog`, `/ingest`, `/ask`, `/guia` (`/about` → `/guia`).                                                                                                     |
| New project in contest period                           | **PASS**    | Public GitHub repo created **2026-08-26** (contest period). Root `LICENSE` = MIT.                                                                                                                                        |
| No LangChain / OpenAI / Anthropic in runtime            | **PASS**    | No imports/deps in `packages/*`; only UI disclaimer strings in `packages/web/src/i18n/translations.ts`.                                                                                                                  |
| Devpost form + ClickHouse track                         | **PASS**    | Draft 1155720 **Submitted**. Hosted URL + video live.                                                                                                                                                                    |

---

## Compliance greps (2026-09-01)

```
@google/genai / GoogleGenAI / generateContent
  → packages/infrastructure/src/gemini/generateContent.ts (lines 1, 33, 40)
  → GeminiEnrichmentAdapter.ts, GeminiReasoningAdapter.ts import generateGeminiText

@google/adk / LlmAgent
  → NOT FOUND in packages/ or examples/

@modelcontextprotocol/sdk callTool run_query
  → McpClickHouseConnector.ts lines 58-60 (run_query), 121-125 (callToolRaw)

FakeGeminiEnrichmentClient
  → packages/infrastructure/src/gemini/FakeGeminiEnrichmentClient.ts
  → packages/infrastructure/tests/unit/FakeGeminiEnrichmentClient.test.ts ONLY
  → NOT imported in packages/api, packages/web, examples/media-workflows

langchain / @langchain / openai / anthropic
  → CLEAN in packages/* (no imports/deps); disclaimer strings only in translations.ts

@clickhouse/client
  → NOT in any packages/*/package.json (removed from product path)
```

---

## Agent architecture

**6-step pipeline** (`packages/orchestration/src/agents/AgentRunner.ts` + `GreenlightAnalyst.ts`):

INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT

- **Catalog Q&A:** DISCOVER (MCP `list_*`) → PLAN_SQL (**Gemini** NL→SQL) → EXECUTE (MCP `run_query`) → SYNTHESIZE (Gemini) → AUDIT.
- **Greenlight:** DISCOVER (4 parallel MCP analytics SELECTs: A genre inventory, B title momentum, C cannibalization, D slate holes) → PLAN_SQL (**TypeScript scorer** in `GreenlightScorer.ts`, not Gemini) → EXECUTE (top 3 candidate rows) → SYNTHESIZE (Gemini narrative only via `@google/genai` — **not** Agent Builder / ADK; 25s timeout or 429/prepaid quota/error → scorer fallback, HTTP 200) → AUDIT.
- **Scorer formula** (`GreenlightScorer.ts`): `opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty + 0.05×language_gap`; `pickTopCandidates` enforces genre diversity (max one per genre when ≥3 genres). `language_gap` on each pick is the raw `D_slate_holes` language `gap_score` (clamped ≥ 0), not a max-normalized proxy.
- **Ask honesty:** `/ask` under-represented chip cites **live** ClickHouse `gap_score` from returned rows — genre can move after ingest; do not treat a recorded Documentary ≈0.074 (or any single genre) as the live answer.
- SQL guard: `packages/core/src/utils/sqlValidation.ts` — blocks DROP/ALTER/TRUNCATE etc.; allows INSERT for ingest/audit.
- AUDIT step builds INSERT with string concat + `escapeSql()` in AgentRunner — injection risk if prompts contain quotes.
- UI timeline: `packages/web/src/components/AgentTimeline.tsx`; `/ask` shows SQL + Evidence; dashboard greenlight panel shows timeline below analytics.

**Greenlight API** (`packages/api/src/index.ts`):

- Cache **10 minutes** (`GREENLIGHT_CACHE_TTL_MS`), bypass with `?refresh=1`; mutex `greenlightInFlight` dedupes concurrent runs.
- Frontend fetch abort 240s: `packages/web/src/api.ts` `AGENT_FETCH_TIMEOUT_MS`.

**Not ADK / not Vertex function calling:** custom `AgentRunner` + prompt-based Gemini adapters.

---

## Remove ClickHouse and the weekly greenlight cannot measure

**Claim (accurate):** Remove ClickHouse / `mcp-clickhouse` and the weekly greenlight cannot measure genre gaps, WoW momentum, cannibalization pairs, or slate holes at runtime — those four MCP SELECTs plus audit inserts disappear; a TypeScript scorer with no measured inputs is useless.

| Query id            | File                                                         | What disappears without ClickHouse                      |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `A_genre_inventory` | `packages/orchestration/src/greenlight/greenlightQueries.ts` | Genre mix: title counts vs 4-week revenue               |
| `B_title_momentum`  | same                                                         | Week-over-week title revenue (`wow_pct`)                |
| `C_cannibalization` | same                                                         | Near-duplicate title pairs that split the same audience |
| `D_slate_holes`     | same                                                         | Genre and language holes (`gap_score`)                  |

**Code paths judges can open:**

| Layer                | Path                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| MCP runtime          | `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts` — official `mcp-clickhouse` `run_query` / `list_*` only |
| Four SELECTs + AUDIT | `packages/orchestration/src/greenlight/GreenlightAnalyst.ts` + `packages/orchestration/src/agents/AgentRunner.ts`                   |
| Ranking              | `packages/orchestration/src/greenlight/GreenlightScorer.ts` — TypeScript; Gemini does **not** plan this SQL                         |
| Gemini               | `@google/genai` — greenlight **narrative** only; `/ask` intent + NL→SQL                                                             |

**Contrast with Flashframe (same track, different product):** Flashframe’s wedge is sliding-window SQL that Gemini then _judges_. Ours is four catalog-slate SELECTs that TypeScript _scores_; Gemini only _explains_. User = streaming **programming chief**, not photosensitivity QC.

Same claim appears on `/judge`, README, and the Devpost Impact/Tech paste in `DEVPOST.md`.

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

| Route      | File                                    | Behavior                                                                                                                                                                                                                                                                                          |
| ---------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`        | `Dashboard.tsx` + `GreenlightPanel.tsx` | Stats + greenlight in parallel (1–3 min cold). Greenlight UI: provenance header (formula + stack badge), **Weekly programming ritual** table (export CSV/JSON), 3 rec-cards with per-card score provenance, ClickHouse analytics panels (genre gap, WoW momentum, cannibal pairs), agent timeline |
| `/catalog` | `Catalog.tsx`                           | Table + filter                                                                                                                                                                                                                                                                                    |
| `/ingest`  | `Ingest.tsx`                            | Form; requires cast (validation)                                                                                                                                                                                                                                                                  |
| `/ask`     | `Ask.tsx`                               | NL question + timeline                                                                                                                                                                                                                                                                            |
| `/judge`   | `Judge.tsx`                             | Judge landing: pitch, architecture strip, 2-minute verify checklist, Remove ClickHouse, jury-evidence JSON export. English primary; EN/ES toggle.                                                                                                                                                 |
| `/guia`    | `Guide.tsx`                             | User guide (EN/ES); `/about` redirects here                                                                                                                                                                                                                                                       |

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

| Claim                                            | Match?                                        |
| ------------------------------------------------ | --------------------------------------------- |
| GitHub URL `armandobecerraro/catalog-greenlight` | YES                                           |
| Path A: Cloud 8443 + `npm run dev`               | YES in README                                 |
| `@google/genai` not `@google/generative-ai`      | YES in code                                   |
| `gemini-flash-latest` default                    | YES `generateContent.ts`, `.env.example`      |
| `.env.example` defaults localhost **8123**       | YES — judges must edit for Cloud              |
| Hosted demo                                      | YES — https://catalog-greenlight.onrender.com |

---

## What is NOT demonstrated

- `@google/adk` / Agent Builder / Vertex ADK
- Grafana MCP (not used — correct for track)
- LangChain, OpenAI, Anthropic
- FakeGemini in production runtime path
- Statistical rigor beyond small catalog (~200 titles)
- Enterprise IAM / multi-tenant governance

---

## File index for quick judge navigation

| Topic             | Path                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| Gemini SDK        | `packages/infrastructure/src/gemini/generateContent.ts`                     |
| MCP ClickHouse    | `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts` |
| Agent             | `packages/orchestration/src/agents/AgentRunner.ts`                          |
| Greenlight scorer | `packages/orchestration/src/greenlight/GreenlightScorer.ts`                 |
| API + greenlight  | `packages/api/src/index.ts`                                                 |
| SQL guard         | `packages/core/src/utils/sqlValidation.ts`                                  |
| Web API client    | `packages/web/src/api.ts`                                                   |
| E2E               | `packages/web/e2e/hackathon.spec.ts`                                        |
| Submission copy   | `docs/submission/DEVPOST.md`                                                |
