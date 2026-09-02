# Devpost submission copy — Catalog Greenlight

Paste these fields into https://agentic-cinema.devpost.com/

---

## Project name

**Catalog Greenlight**

## Tagline

**ClickHouse measures. TypeScript scores. Gemini explains.**

## Elevator pitch (short description)

Catalog Greenlight is a web app for a streaming programming chief. Each week it greenlights three titles because **ClickHouse measured** genre gaps, week-over-week revenue momentum, and cannibalization — not because Gemini improvised. Four fixed MCP analytics queries run in parallel; a deterministic TypeScript scorer ranks candidates (`opportunity = 0.4×genre_gap + 0.4×wow − 0.2×cannibalization`) and enforces genre diversity. Gemini (`@google/genai`) writes the narrative only. If synthesis fails or hangs, the dashboard still shows three scorer picks with measured `opportunity_score`, `wow_pct`, and `genre_gap`.

## Built with

- **ClickHouse** — catalog + weekly revenue + agent audit tables; runtime access only via official [mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse)
- **Google Gemini API** — `@google/genai` (`gemini-flash-latest`) on Google Cloud; direct `GoogleGenAI` + `generateContent` — **not** Agent Builder, ADK, or Vertex function-calling
- **MCP** — `@modelcontextprotocol/sdk` stdio client (`run_query`, `list_databases`, `list_tables`)
- **TypeScript monorepo** — hexagonal architecture (core / infrastructure / orchestration / api / web)
- **React + Vite** — dashboard with greenlight metrics, catalog, ingest, ask-with-timeline
- **Docker** — local ClickHouse + seed (~200 titles with judge-visible demo story)

## Link to demo (hosted app)

https://catalog-greenlight.onrender.com

(Render + ClickHouse Cloud **8443** + `CLICKHOUSE_SECURE=true`; see `docs/submission/DEPLOY.md`. Local fallback: `npm run dev` → http://localhost:5173. **Record the demo video against the hosted URL** — see `docs/submission/VIDEO_CHECKLIST.md`.)

## Link to GitHub repo

https://github.com/armandobecerraro/catalog-greenlight

## Video demo (3 min, English)

`TODO_YOUTUBE` — shot list + narration: `docs/submission/VIDEO_CHECKLIST.md` (summary in README.md § “3-minute demo video script”). Record against https://catalog-greenlight.onrender.com only.

## What it does

1. **Dashboard** — live catalog stats from ClickHouse via MCP, plus **Greenlight this week**: three titles with measured scores (opportunity, WoW %, genre gap) and Gemini narrative
2. **Ingest** — add a title; Gemini enriches summary/tags; MCP INSERT persists it
3. **Ask the catalog** — natural language → 6-step agent timeline → Gemini-planned SQL → result rows → grounded recommendations
4. **Greenlight pipeline** — four parallel MCP SELECTs → TypeScript scorer → Gemini synthesis (bounded timeout; scorer fallback if Gemini fails)

Gemini does **not** plan SQL for the greenlight path.

## How we use ClickHouse (required)

- Official **mcp-clickhouse** at runtime — no direct Node ClickHouse client in product code
- Greenlight: four fixed analytics queries (genre inventory, title momentum, cannibalization pairs, slate holes) executed in parallel via MCP `run_query`
- Catalog Q&A: Gemini-generated SELECT with SQL guard (blocks DROP/ALTER/TRUNCATE); schema discovered live from `system.columns`
- ~200-title seed catalog with 10 weeks of revenue; demo story surfaces LATAM breakout _Crimen sin Fronteras: Bogotá_, Thriller gap, and cannibal-pair penalty on _True Crime: Highway 101_
- Agent runs audited via MCP INSERT into `agent_runs`

## How we use Google Cloud AI (required)

- **Gemini API on Google Cloud** via `@google/genai` — not Agent Builder, not ADK, not a no-code agent product
- `packages/infrastructure/src/gemini/generateContent.ts` — `GoogleGenAI` + `models.generateContent`
- **Ingest** — `GeminiEnrichmentAdapter.ts` enriches title metadata
- **Catalog Q&A** — `GeminiReasoningAdapter.ts` classifies intent, generates SQL, synthesizes answers
- **Greenlight** — same adapter's `synthesizeGreenlight` writes executive narrative from scorer candidate rows only; scoring is TypeScript, not Gemini
- Fails fast if `GEMINI_API_KEY` is missing (no silent fake in API/demo/web)
- Synthesis bounded to 10s; timeout or error → three scorer recommendations still returned (SYNTHESIZE step marked error)

## Try it yourself

```bash
git clone https://github.com/armandobecerraro/catalog-greenlight
cd catalog-greenlight
cp .env.example .env   # GEMINI_API_KEY + ClickHouse Cloud host (8443, SECURE=true)
npm install
npm run dev   # http://localhost:5173
```

Force a fresh greenlight run (bypass 10-min cache): `GET /api/v1/greenlight?refresh=1`

For local Docker ClickHouse instead: `npm run demo` (see README Path B).

## Team / attribution

Armando Becerra Rodríguez

## License

MIT
