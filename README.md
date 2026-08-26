# Catalog Greenlight

**Agentic Cinema Hackathon — ClickHouse Track**

> The agent that tells programming what to push — with ClickHouse evidence.

Catalog Greenlight is a web product for a **programming chief** at a small Latin/US streaming studio. The agent investigates your ClickHouse catalog via the official **mcp-clickhouse** MCP server, reasons with **Gemini** (`@google/generative-ai`), and returns actionable greenlight recommendations backed by SQL and row data.

## Prerequisites

| Requirement | Version / notes |
|---|---|
| Node.js | 20+ |
| Docker | ClickHouse local cluster |
| [uv](https://docs.astral.sh/uv/) | Spawns `mcp-clickhouse` via stdio |
| `GEMINI_API_KEY` | **Required** for demo, API, and UI (no silent fake fallback) |

## Quick start (< 10 minutes)

```bash
git clone <your-repo-url>
cd blockbuster-agentic-studio
cp .env.example .env   # add GEMINI_API_KEY
export $(grep -v '^#' .env | xargs)

npm install
export GEMINI_API_KEY=your_key_here
npm run demo
```

`npm run demo` will:

1. Start ClickHouse (`deployment/docker/docker-compose.clickhouse.yml`)
2. Apply schema + seed **50 titles** (`deployment/docker/seed-catalog.sql`)
3. Ingest one new title with **real Gemini**
4. Print catalog stats, an NL question, greenlight picks, and agent step latencies

### Web UI + API

```bash
export GEMINI_API_KEY=your_key_here
npm run dev
```

- Web: http://localhost:5173 (proxies `/api` → API)
- API: http://localhost:8080
- Health: `GET /api/v1/health`

| Route | Description |
|---|---|
| `/` | Dashboard — MCP stats + Greenlight this week |
| `/catalog` | Full catalog table |
| `/ingest` | Ingest form → Gemini enrich → MCP INSERT |
| `/ask` | NL questions with 6-step agent timeline + SQL evidence |

## Runtime evidence (for judges)

### Gemini — `@google/generative-ai`

| File | Role |
|---|---|
| `packages/infrastructure/src/gemini/GeminiEnrichmentAdapter.ts` | `GoogleGenerativeAI`, `generateContent` for ingest enrichment |
| `packages/infrastructure/src/gemini/GeminiReasoningAdapter.ts` | `generateContent` for intent, SQL planning, synthesis |
| `packages/infrastructure/src/gemini/resolveGeminiApiKey.ts` | Fails fast if `GEMINI_API_KEY` missing |

Model default: `gemini-2.0-flash` (override with `GEMINI_MODEL`).

### ClickHouse — official `mcp-clickhouse` only (runtime)

| File | Role |
|---|---|
| `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts` | Spawns MCP via `uv run --with mcp-clickhouse`; calls `run_query`, `list_databases`, `list_tables` through `@modelcontextprotocol/sdk` `Client.callTool` |
| `packages/orchestration/src/agents/AgentRunner.ts` | 6-step deterministic agent: INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT |

`@clickhouse/client` is used **only** for Docker seed/init scripts — never by the agent or product API.

Default ClickHouse HTTP port: **8123**.

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

See `.env.example`. Key vars:

```bash
GEMINI_API_KEY=              # required
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=media_catalog
CLICKHOUSE_SECURE=false
CLICKHOUSE_ALLOW_WRITE_ACCESS=true
```

## Testing & build

```bash
npm run build
npm test
```

- Unit tests use **injected** `FakeGeminiEnrichmentClient` — never in API/demo/web.
- `AgentRunner` tests mock MCP + reasoning and assert all 6 steps.
- Optional integration test (requires Docker + API key): documented in `packages/infrastructure/tests/`.

## Deployment

### Docker (app + ClickHouse)

```bash
docker compose -f deployment/docker/docker-compose.prod.yml up --build
```

### Cloud Run + ClickHouse Cloud

1. Provision ClickHouse Cloud service (HTTP port 8443 or 8123).
2. Build & push image from root `Dockerfile`.
3. Deploy to Cloud Run with env vars from `.env.example`.
4. Set `CLICKHOUSE_SECURE=true` for ClickHouse Cloud TLS.

## Hackathon compliance (Stage One)

| Requirement | Status |
|---|---|
| Web platform | ✅ React UI (`packages/web`) |
| ClickHouse at runtime via official mcp-clickhouse | ✅ `McpClickHouseConnector` |
| Google Cloud AI SDK imported & called | ✅ `@google/generative-ai` |
| No LangChain / OpenAI / Anthropic | ✅ Removed from all package.json |
| Multi-step agent (not 2-call pipeline) | ✅ `AgentRunner` 6 steps + UI timeline |
| Gemini real in demo/API (no silent fake) | ✅ `resolveGeminiApiKey()` throws |

## Monorepo layout

```
packages/
  core/            Domain, ports, InsightEngineService
  infrastructure/  McpClickHouseConnector, Gemini adapters
  orchestration/   AgentRunner, MediaIngestionAgent
  api/             Express API + static web
  web/             React + Vite UI
examples/media-workflows/  CLI demo (same agent as UI)
deployment/docker/         ClickHouse, seed SQL, prod compose
```

## 3-minute demo video script (English)

1. **0:00–0:20** — Problem: programming chief needs data-backed picks, not generic AI summaries.
2. **0:20–0:45** — Dashboard: live stats from ClickHouse (genre counts, 7-day revenue via MCP).
3. **0:45–1:15** — Ingest: add a title → show Gemini enrichment → confirm row in catalog.
4. **1:15–2:00** — Ask: “Which genre is under-represented?” → expand agent timeline → show SQL + result rows + answer.
5. **2:00–2:30** — Greenlight panel: 3 titles with justifications tied to query evidence.
6. **2:30–3:00** — Architecture: mcp-clickhouse + Gemini SDK, `npm run demo`, GitHub repo.

## Git remote (after clone)

This repo ships with an initial local commit. To push:

```bash
git remote add origin <your-github-url>
git push -u origin main
```

## License

MIT — see [LICENSE](./LICENSE).
