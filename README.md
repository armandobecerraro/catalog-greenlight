# Catalog Greenlight

**Agentic Cinema Hackathon — ClickHouse Track**

> **ClickHouse measures. TypeScript scores. Gemini explains.**

**Catalog Greenlight** is a web product for a streaming **programming chief** at a small Latin/US streaming studio. Each week it greenlights three titles in a **catalog slate**: four fixed MCP SELECTs at runtime, a transparent **TypeScript scorer** (`GreenlightScorer.ts`) ranks candidates and enforces genre diversity, and **Gemini** (`@google/genai` on Google Cloud — **not** Agent Builder / ADK) writes the narrative only — it does not plan greenlight SQL. If Gemini synthesis fails, times out, or returns 429, the dashboard still shows three scorer picks. Catalog Q&A on `/ask` uses Gemini for intent and NL→SQL.

**Not Chloe:** the competing **Chloe** entry targets screenplay→film production; **Catalog Greenlight** targets weekly catalog programming decisions backed by ClickHouse analytics.

**Repository:** https://github.com/armandobecerraro/catalog-greenlight

**Live demo:** https://catalog-greenlight.onrender.com

**Demo video:** `TODO_YOUTUBE` — shot list and timing in `docs/submission/VIDEO_CHECKLIST.md` (record against the hosted URL only).

## User documentation

| Document                                         | Language | Description                                                     |
| ------------------------------------------------ | -------- | --------------------------------------------------------------- |
| **[docs/GUIA_DE_USO.md](./docs/GUIA_DE_USO.md)** | Español  | Guía completa: qué es, para qué sirve, pantallas paso a paso    |
| **[docs/USER_GUIDE.md](./docs/USER_GUIDE.md)**   | English  | Short user guide + link to Spanish doc                          |
| **http://localhost:5173/guia**                   | EN / ES  | Guía de uso completa en la app (también `/about` redirige aquí) |

## Prerequisites

| Requirement                      | Version / notes                                                    |
| -------------------------------- | ------------------------------------------------------------------ |
| Node.js                          | 20+                                                                |
| [uv](https://docs.astral.sh/uv/) | Spawns `mcp-clickhouse` via stdio (`$HOME/.local/bin`)             |
| `GEMINI_API_KEY`                 | **Required** for API and UI (no silent fake fallback)              |
| ClickHouse                       | ClickHouse Cloud (production path) **or** local Docker (demo path) |

## Path A — ClickHouse Cloud + web UI (recommended for judges)

This is the production configuration: HTTPS to ClickHouse Cloud, Gemini via `@google/genai`, UI at `:5173`.

```bash
git clone https://github.com/armandobecerraro/catalog-greenlight
cd catalog-greenlight
cp .env.example .env
# Edit .env: GEMINI_API_KEY, CLICKHOUSE_HOST, CLICKHOUSE_PORT=8443, CLICKHOUSE_SECURE=true

npm install
npm run dev
# or: PATH="$HOME/.local/bin:$PATH" bash scripts/dev.sh
```

| URL                                 | Role                                          |
| ----------------------------------- | --------------------------------------------- |
| http://localhost:5173               | React UI (Vite proxies `/api` → API)          |
| http://localhost:8080/api/v1/health | API health (`ready: true` when MCP connected) |

`npm run dev` loads repo-root `.env` automatically (`loadRepoEnv` in `@bas/infrastructure`).

| Route      | Description                                                  |
| ---------- | ------------------------------------------------------------ |
| `/`        | Dashboard — MCP stats + Greenlight this week                 |
| `/catalog` | Full catalog table                                           |
| `/ingest`  | Ingest form → Gemini enrich → MCP INSERT                     |
| `/ask`     | NL questions with 6-step agent timeline + SQL evidence       |
| `/about`   | Redirects to `/guia`                                         |
| `/guia`    | **User guide** — what the app does and how to use it (EN/ES) |

**Do not** run `npm run demo` on this path — that script starts local Docker ClickHouse and is for Path B.

## Path B — Local Docker ClickHouse + CLI demo (secondary)

```bash
git clone https://github.com/armandobecerraro/catalog-greenlight
cd catalog-greenlight
cp .env.example .env   # GEMINI_API_KEY required; CLICKHOUSE_HOST=localhost, PORT=8123
npm install
npm run demo
```

`npm run demo` starts ClickHouse Docker, seeds **~200 titles** (demo story), runs CLI ingest + stats + NL question + greenlight via the same agent stack.

Optional web UI against local ClickHouse:

```bash
npm run dev
```

## Runtime evidence (for judges)

### Gemini — `@google/genai`

| File                                                            | Role                                     |
| --------------------------------------------------------------- | ---------------------------------------- |
| `packages/infrastructure/src/gemini/generateContent.ts`         | `GoogleGenAI` + `models.generateContent` |
| `packages/infrastructure/src/gemini/GeminiEnrichmentAdapter.ts` | Ingest enrichment                        |
| `packages/infrastructure/src/gemini/GeminiReasoningAdapter.ts`  | Intent, SQL planning, synthesis          |
| `packages/infrastructure/src/gemini/resolveGeminiApiKey.ts`     | Fails fast if `GEMINI_API_KEY` missing   |

Model default: `gemini-flash-latest` (override with `GEMINI_MODEL`).

### ClickHouse — official `mcp-clickhouse` only (runtime)

| File                                                                        | Role                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts` | Spawns MCP via `uv run --with mcp-clickhouse`; `Client.callTool` → `run_query`, `list_databases`, `list_tables` |
| `packages/orchestration/src/agents/AgentRunner.ts`                          | 6-step agent: INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT                                       |

Seed data is loaded via Docker `clickhouse-client` only (`deployment/scripts/seed.sh`) — never by the agent or product API.

## Agent architecture

**Greenlight** (`GET /api/v1/greenlight`):

```
INTENT (skipped — default greenlight)
  → DISCOVER   (4 parallel MCP SELECTs: genre inventory, WoW momentum, cannibalization, slate holes)
  → PLAN_SQL   (TypeScript scorer — not Gemini)
  → EXECUTE    (top 3 candidate rows)
  → SYNTHESIZE (Gemini narrative only; 10s timeout or 429/error → scorer fallback, HTTP 200)
  → AUDIT      (MCP INSERT into agent_runs; failure logged, recs still returned)
```

**Catalog Q&A** (`POST /api/v1/agent/ask`):

```
User question
    → INTENT      (Gemini classifies: ingest | catalog_qa | greenlight | stats)
    → DISCOVER    (MCP list_databases / list_tables + live schema)
    → PLAN_SQL    (Gemini generates ClickHouse SQL)
    → EXECUTE     (MCP run_query)
    → SYNTHESIZE  (Gemini answer + recommendations citing row data)
    → AUDIT       (MCP INSERT into agent_runs)
```

The UI `/ask` page renders the 6-step timeline for judges. Greenlight responses are cached 10 minutes; bypass with `GET /api/v1/greenlight?refresh=1` for live demos.

## Environment variables

See `.env.example`.

**ClickHouse Cloud:**

```bash
GEMINI_API_KEY=
CLICKHOUSE_HOST=<your-cloud-host>
CLICKHOUSE_PORT=8443
CLICKHOUSE_SECURE=true
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=media_catalog
CLICKHOUSE_ALLOW_WRITE_ACCESS=true
```

**Local Docker (Path B):**

```bash
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_SECURE=false
```

## Testing & build

```bash
npm run build
npm test
npm run check:credentials   # verify GEMINI_API_KEY + ClickHouse MCP (no secrets printed)
npm run test:e2e   # requires npm run dev + .env with Cloud or local CH
```

- Unit tests use injected `FakeGeminiEnrichmentClient` — never in API/demo/web.
- E2E: `packages/web/e2e/hackathon.spec.ts` (Playwright against `:5173`).

## Deployment

### Docker (app image includes uv + mcp-clickhouse smoke)

```bash
docker build -t catalog-greenlight .
# Cloud Run: set env from .env.example; CLICKHOUSE_SECURE=true for Cloud
```

### Local full stack (app + ClickHouse)

```bash
docker compose -f deployment/docker/docker-compose.prod.yml up --build
```

**Hosted demo:** https://catalog-greenlight.onrender.com on Render (ClickHouse Cloud; see `docs/submission/DEPLOY.md`). Local: `npm run dev` → http://localhost:5173.

## Hackathon compliance (Stage One)

| Requirement                                       | Status                                 |
| ------------------------------------------------- | -------------------------------------- |
| Web platform                                      | ✅ React UI (`packages/web`)           |
| ClickHouse at runtime via official mcp-clickhouse | ✅ `McpClickHouseConnector`            |
| Google Cloud AI SDK imported & called             | ✅ `@google/genai`                     |
| No LangChain / OpenAI / Anthropic                 | ✅                                     |
| Multi-step agent (not 2-call pipeline)            | ✅ `AgentRunner` 6 steps + UI timeline |
| Gemini real in demo/API (no silent fake)          | ✅ `resolveGeminiApiKey()` throws      |

## Monorepo layout

```
packages/
  core/            Domain, ports, InsightEngineService
  infrastructure/  McpClickHouseConnector, Gemini adapters, loadRepoEnv
  orchestration/   AgentRunner, MediaIngestionAgent
  api/             Express API + static web
  web/             React + Vite UI
examples/media-workflows/  CLI demo (same agent as UI; loads repo .env)
deployment/docker/         ClickHouse, seed SQL, prod compose
```

## 3-minute demo video script (English)

**Record against the hosted app only** — https://catalog-greenlight.onrender.com (not localhost). Pre-warm Render 60–90 s; hit `?refresh=1` before rolling. Full word-for-word script, shot list, branches, and checklist: `docs/submission/VIDEO_CHECKLIST.md`.

| Time | Scene | What to show | Branch B |
|------|-------|--------------|----------|
| 0:00–0:20 | Hook | Say **Catalog Greenlight** — programming chief needs weekly greenlight picks backed by evidence, not vibes. | — |
| 0:20–0:45 | Dashboard stats | **https://catalog-greenlight.onrender.com** — catalog size, genre breakdown, latest revenue (ClickHouse via **mcp-clickhouse** MCP). | — |
| 0:45–1:15 | Ingest | `/ingest` — “Midnight Signal”, Sci-Fi → Gemini enrichment → `/catalog` new row. | Gemini down: say “Ingest needs Gemini; skipping to Ask/Greenlight” → skip to Ask or Greenlight. |
| 1:15–2:00 | Ask | `/ask` — “Which genre is under-represented in our catalog?” → 6-step timeline → SQL → evidence → grounded answer. | HTTP 429: note “If 429, record Ask after credits”; finish Greenlight + architecture, splice Ask later. |
| 2:00–2:30 | Greenlight | **Greenlight this week** — three rec-cards + provenance. **Say aloud:** “ClickHouse measures. TypeScript scores. Gemini explains.” | — |
| 2:30–3:00 | Architecture | Slide: `mcp-clickhouse` + `@google/genai` (Gemini API on Google Cloud — **not Agent Builder**) + GitHub + hosted URL. | — |

Paste the YouTube link into `docs/submission/DEVPOST.md` as `TODO_YOUTUBE` when uploaded.

## License

MIT — see [LICENSE](./LICENSE).
