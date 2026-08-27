# Catalog Greenlight

**Agentic Cinema Hackathon — ClickHouse Track**

> The agent that tells programming what to push — with ClickHouse evidence.

Catalog Greenlight is a web product for a **programming chief** at a small Latin/US streaming studio. The agent investigates your ClickHouse catalog via the official **mcp-clickhouse** MCP server, reasons with **Gemini** (`@google/genai`), and returns actionable greenlight recommendations backed by SQL and row data.

**Repository:** https://github.com/armandobecerraro/catalog-greenlight

## Prerequisites

| Requirement | Version / notes |
|---|---|
| Node.js | 20+ |
| [uv](https://docs.astral.sh/uv/) | Spawns `mcp-clickhouse` via stdio (`$HOME/.local/bin`) |
| `GEMINI_API_KEY` | **Required** for API and UI (no silent fake fallback) |
| ClickHouse | ClickHouse Cloud (production path) **or** local Docker (demo path) |

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

| URL | Role |
|---|---|
| http://localhost:5173 | React UI (Vite proxies `/api` → API) |
| http://localhost:8080/api/v1/health | API health (`ready: true` when MCP connected) |

`npm run dev` loads repo-root `.env` automatically (`loadRepoEnv` in `@bas/infrastructure`).

| Route | Description |
|---|---|
| `/` | Dashboard — MCP stats + Greenlight this week (may take 1–2 min first load) |
| `/catalog` | Full catalog table |
| `/ingest` | Ingest form → Gemini enrich → MCP INSERT |
| `/ask` | NL questions with 6-step agent timeline + SQL evidence |

**Do not** run `npm run demo` on this path — that script starts local Docker ClickHouse and is for Path B.

## Path B — Local Docker ClickHouse + CLI demo (secondary)

```bash
git clone https://github.com/armandobecerraro/catalog-greenlight
cd catalog-greenlight
cp .env.example .env   # GEMINI_API_KEY required; CLICKHOUSE_HOST=localhost, PORT=8123
npm install
npm run demo
```

`npm run demo` starts ClickHouse Docker, seeds **50 titles**, runs CLI ingest + stats + NL question + greenlight via the same agent stack.

Optional web UI against local ClickHouse:

```bash
npm run dev
```

## Runtime evidence (for judges)

### Gemini — `@google/genai`

| File | Role |
|---|---|
| `packages/infrastructure/src/gemini/generateContent.ts` | `GoogleGenAI` + `models.generateContent` |
| `packages/infrastructure/src/gemini/GeminiEnrichmentAdapter.ts` | Ingest enrichment |
| `packages/infrastructure/src/gemini/GeminiReasoningAdapter.ts` | Intent, SQL planning, synthesis |
| `packages/infrastructure/src/gemini/resolveGeminiApiKey.ts` | Fails fast if `GEMINI_API_KEY` missing |

Model default: `gemini-flash-latest` (override with `GEMINI_MODEL`).

### ClickHouse — official `mcp-clickhouse` only (runtime)

| File | Role |
|---|---|
| `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts` | Spawns MCP via `uv run --with mcp-clickhouse`; `Client.callTool` → `run_query`, `list_databases`, `list_tables` |
| `packages/orchestration/src/agents/AgentRunner.ts` | 6-step agent: INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT |

Seed data is loaded via Docker `clickhouse-client` only (`deployment/scripts/seed.sh`) — never by the agent or product API.

## Agent architecture

```
User question
    → INTENT      (Gemini classifies: ingest | catalog_qa | greenlight | stats)
    → DISCOVER    (MCP list_databases / list_tables)
    → PLAN_SQL    (Gemini generates ClickHouse SQL)
    → EXECUTE     (MCP run_query)
    → SYNTHESIZE  (Gemini answer + recommendations citing row data)
    → AUDIT       (MCP INSERT into agent_runs)
```

The UI `/ask` page renders this timeline for judges.

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

Hosted deploy: see `docs/submission/DEPLOY.md` (not deployed in this submission — GCP credits / manual step).

## Hackathon compliance (Stage One)

| Requirement | Status |
|---|---|
| Web platform | ✅ React UI (`packages/web`) |
| ClickHouse at runtime via official mcp-clickhouse | ✅ `McpClickHouseConnector` |
| Google Cloud AI SDK imported & called | ✅ `@google/genai` |
| No LangChain / OpenAI / Anthropic | ✅ |
| Multi-step agent (not 2-call pipeline) | ✅ `AgentRunner` 6 steps + UI timeline |
| Gemini real in demo/API (no silent fake) | ✅ `resolveGeminiApiKey()` throws |

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

1. **0:00–0:20** — Problem: programming chief needs data-backed picks, not generic AI summaries.
2. **0:20–0:45** — Open **http://localhost:5173** — Dashboard: live stats from ClickHouse (genre counts, 7-day revenue via MCP).
3. **0:45–1:15** — **Ingest** page: add a title → show Gemini enrichment success → **Catalog** confirms the row.
4. **1:15–2:00** — **Ask**: “Which genre is under-represented?” → expand agent timeline → show SQL + result rows + answer with numbers.
5. **2:00–2:30** — Dashboard Greenlight panel: 3 titles with justifications tied to query evidence.
6. **2:30–3:00** — Architecture slide: mcp-clickhouse + `@google/genai`, GitHub repo, `npm run dev`.

## License

MIT — see [LICENSE](./LICENSE).
