# Devpost submission copy — Catalog Greenlight

Paste these fields into https://agentic-cinema.devpost.com/

---

## Project name

**Catalog Greenlight**

## Tagline

The agent that tells programming what to title to push — with ClickHouse evidence.

## Elevator pitch (short description)

Catalog Greenlight is a web app for a streaming programming chief. It connects Gemini (`@google/generative-ai`) to a real ClickHouse catalog through the official **mcp-clickhouse** MCP server. The agent runs a 6-step pipeline (INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT), shows SQL + row evidence in the UI, and recommends weekly greenlight picks backed by catalog and revenue data — not generic movie trivia.

## Built with

- **ClickHouse** — catalog + revenue + agent audit tables; runtime access only via [mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse)
- **Google Gemini** — `@google/generative-ai` (`gemini-2.0-flash`) for enrichment, SQL planning, and synthesis
- **MCP** — `@modelcontextprotocol/sdk` stdio client (`run_query`, `list_databases`, `list_tables`)
- **TypeScript monorepo** — Clean Architecture (core / infrastructure / orchestration / api / web)
- **React + Vite** — dashboard, catalog, ingest, ask-with-timeline
- **Docker** — local ClickHouse + production Dockerfile

## Link to demo (hosted app)

`https://<YOUR_RENDER_OR_CLOUD_RUN_URL>` — see `docs/submission/DEPLOY.md`

## Link to GitHub repo

`https://github.com/<YOUR_ORG>/catalog-greenlight` — see `docs/submission/VERIFICATION.md` § Repository

## Video demo (3 min, English)

`https://<YOUR_YOUTUBE_OR_LOOM_URL>`

Script: README.md § “3-minute demo video script”

## What it does

1. **Dashboard** — live catalog stats and 7-day revenue from ClickHouse via MCP
2. **Ingest** — add a title; Gemini enriches summary/tags/positioning; MCP INSERT persists it
3. **Ask the catalog** — natural language → agent timeline → SQL executed → result rows → recommendation
4. **Greenlight this week** — 3 data-backed picks for programming

## How we use ClickHouse (required)

- Official MCP server at runtime — no direct Node ClickHouse client in product code
- Agent generates SELECT for Q&A/greenlight; SQL guard blocks DROP/ALTER/TRUNCATE
- 50-title seed catalog with revenue table for meaningful recommendations

## How we use Google Cloud AI (required)

- `GeminiEnrichmentAdapter.ts` — `GoogleGenerativeAI` + `generateContent` on ingest
- `GeminiReasoningAdapter.ts` — intent classification, SQL generation, answer synthesis
- Fails fast if `GEMINI_API_KEY` is missing (no silent fake in API/demo/web)

## Try it yourself

```bash
git clone https://github.com/<YOUR_ORG>/catalog-greenlight
cd catalog-greenlight
cp .env.example .env   # add GEMINI_API_KEY
export $(grep -v '^#' .env | xargs)
npm install && npm run demo
npm run dev   # http://localhost:5173
```

## Team / attribution

[Your name(s)]

## License

MIT
