# Devpost submission copy — Catalog Greenlight

Paste these fields into https://agentic-cinema.devpost.com/ (draft **1155720**, track **ClickHouse**).

---

## Devpost fields (copy-paste)

| Field              | Value                                                                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Draft**          | 1155720                                                                                                                                                                                                                                                                                                  |
| **Track**          | ClickHouse                                                                                                                                                                                                                                                                                               |
| **Project name**   | Catalog Greenlight                                                                                                                                                                                                                                                                                       |
| **Tagline**        | ClickHouse measures. TypeScript scores. Gemini explains.                                                                                                                                                                                                                                                 |
| **Built with**     | ClickHouse, mcp-clickhouse, Google Gemini API (`@google/genai`), MCP, TypeScript, React, Docker                                                                                                                                                                                                          |
| **Link to demo**   | https://catalog-greenlight.onrender.com                                                                                                                                                                                                                                                                  |
| **Link to GitHub** | https://github.com/armandobecerraro/catalog-greenlight                                                                                                                                                                                                                                                   |
| **What it does**   | Web app for a streaming **programming chief**: four parallel MCP SELECTs measure the catalog; a transparent TypeScript scorer ranks three weekly greenlight picks; Gemini (`@google/genai` on Google Cloud — **not** Agent Builder / ADK) writes the narrative only. Catalog Q&A uses Gemini for NL→SQL. |

---

## vs Chloe (same hackathon)

|                 | **Catalog Greenlight** (this project)                   | **Chloe** (competing entry)  |
| --------------- | ------------------------------------------------------- | ---------------------------- |
| **User**        | Streaming **programming chief**                         | Filmmaker / writer           |
| **Output**      | Weekly **catalog slate** — three titles to push         | Screenplay → film production |
| **Analytics**   | Four fixed MCP SELECTs + **TypeScript scorer**          | Different stack / workflow   |
| **Gemini role** | Narrative synthesis only (greenlight); NL→SQL on `/ask` | Production-oriented agent    |

---

## Project name

**Catalog Greenlight**

## Tagline

**ClickHouse measures. TypeScript scores. Gemini explains.**

## Elevator pitch (short description)

**Catalog Greenlight** is a web app for a streaming **programming chief**. Each week it greenlights three titles in a **catalog slate** because **ClickHouse measured** genre gaps, week-over-week revenue momentum, cannibalization, and language holes — not because Gemini improvised. Four fixed MCP analytics queries run in parallel at runtime; a deterministic **TypeScript scorer** ranks candidates (`opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty + 0.05×language_gap`; see `GreenlightScorer.ts`) and enforces genre diversity. Gemini (`@google/genai` on Google Cloud — **not** Agent Builder / ADK) writes the narrative only. If synthesis fails, times out (10s), or hits 429/quota, the dashboard still returns three scorer picks with measured `opportunity_score`, `wow_pct`, and `genre_gap`.

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

1. **Dashboard** — live catalog stats from ClickHouse via MCP, plus **Greenlight this week**: provenance header (scorer formula), weekly programming ritual table (export CSV/JSON), three rec-cards with per-card score provenance, ClickHouse analytics panels, and Gemini narrative
2. **Ingest** — add a title; Gemini enriches summary/tags; MCP INSERT persists it
3. **Ask the catalog** — natural language → 6-step agent timeline → Gemini-planned SQL → result rows → grounded recommendations
4. **Greenlight pipeline** — four parallel MCP SELECTs → TypeScript scorer → Gemini synthesis (10s timeout; scorer fallback on failure, timeout, or 429)

Gemini does **not** plan SQL for the greenlight path.

## How we use ClickHouse (required)

- Official **mcp-clickhouse** at runtime — no direct Node ClickHouse client in product code
- Greenlight: four fixed analytics queries (genre inventory, title momentum, cannibalization pairs, slate holes) executed in parallel via MCP `run_query`
- Catalog Q&A: Gemini-generated SELECT with SQL guard (blocks DROP/ALTER/TRUNCATE); schema discovered live from `system.columns`
- ~200-title seed catalog with 10 weeks of revenue; demo story surfaces LATAM breakout _Crimen sin Fronteras: Bogotá_, Thriller gap, and cannibal-pair penalty on _True Crime: Highway 101_
- Agent runs audited via MCP INSERT into `agent_runs`

**Remove ClickHouse and the product disappears.** Without ClickHouse there are no genre-gap or revenue-share measurements, no week-over-week title momentum, no cannibalization pairs, and nothing for the TypeScript scorer to rank. Postgres-or-SQLite “analytics” cannot replace those four measured MCP queries at demo fidelity. Gemini never invents the weekly slate; it only narrates scores that ClickHouse already produced.

## How we use Google Cloud AI (required)

- **Gemini API on Google Cloud** via `@google/genai` — not Agent Builder, not ADK, not a no-code agent product
- `packages/infrastructure/src/gemini/generateContent.ts` — `GoogleGenAI` + `models.generateContent`
- **Ingest** — `GeminiEnrichmentAdapter.ts` enriches title metadata
- **Catalog Q&A** — `GeminiReasoningAdapter.ts` classifies intent, generates SQL, synthesizes answers
- **Greenlight** — same adapter's `synthesizeGreenlight` writes executive narrative from scorer candidate rows only; scoring is TypeScript, not Gemini
- Fails fast if `GEMINI_API_KEY` is missing (no silent fake in API/demo/web)
- Synthesis bounded to 10s (`GREENLIGHT_SYNTHESIZE_TIMEOUT_MS`); timeout, API error, or **429/quota** → three scorer recommendations still returned (HTTP 200; SYNTHESIZE step completes with `fallback: true`)

## Try it yourself

```bash
git clone https://github.com/armandobecerraro/catalog-greenlight
cd catalog-greenlight
cp .env.example .env   # GEMINI_API_KEY + ClickHouse Cloud host (8443, SECURE=true)
npm install
npm run check:credentials   # optional: verify Gemini + ClickHouse before dev
npm run dev   # http://localhost:5173
```

Force a fresh greenlight run (bypass 10-min cache): `GET /api/v1/greenlight?refresh=1`

For local Docker ClickHouse instead: `npm run demo` (see README Path B).

## Team / attribution

Armando Becerra Rodríguez

## License

MIT

---

## Impact (paste into Devpost)

**Catalog Greenlight** is for a streaming **programming chief**, not a filmmaker. Each week that user must pick a **catalog slate** — three titles to push — from measured catalog economics, not from LLM vibes.

**Remove ClickHouse / mcp-clickhouse and the weekly greenlight cannot measure genre gaps, WoW momentum, cannibalization pairs, or slate holes at runtime** — those four MCP SELECTs (`A_genre_inventory`, `B_title_momentum`, `C_cannibalization`, `D_slate_holes`) plus audit inserts disappear; a TypeScript scorer with no measured inputs is useless. Gemini never invents the slate; it only narrates scores ClickHouse already produced.

This is a different job than Chloe (screenplay → film) and a different ClickHouse story than Flashframe (sliding-window QC that Gemini _judges_). We keep ranking in TypeScript so a judge can audit the formula when Gemini is down.

Live: https://catalog-greenlight.onrender.com/judge

## Tech Implementation (paste into Devpost)

Runtime ClickHouse **only** via official **mcp-clickhouse** (`McpClickHouseConnector.ts` → `run_query`). Google AI **only** via `@google/genai` (`GoogleGenAI` + `generateContent`) — not Agent Builder, ADK, OpenAI, Anthropic, or LangChain.

**Greenlight path:** four fixed MCP SELECTs in parallel → deterministic TypeScript scorer (`GreenlightScorer.ts`: `opportunity = 0.4×genre_gap + 0.4×wow_momentum − 0.2×cannibalization_penalty + 0.05×language_gap`, genre diversity) → Gemini narrative with 10s timeout (429/error → three scorer picks, HTTP 200). Gemini does **not** plan greenlight SQL.

**Ask path:** Gemini classifies intent and writes NL→SQL; MCP executes; answers are grounded in returned rows.

**Pitch:** ClickHouse measures. TypeScript scores. Gemini explains.
