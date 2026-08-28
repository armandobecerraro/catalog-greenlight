# Architecture Documentation

## System Overview

**Catalog Greenlight** is an agentic programming dashboard for the Agentic Cinema hackathon (ClickHouse track). A programming chief receives a weekly slate of three titles because the agent **measured** genre gaps, week-over-week revenue momentum, and cannibalization — not because Gemini improvised after a single `SELECT`.

Runtime AI is **`@google/genai` only**. ClickHouse access is **only** via official `mcp-clickhouse` (`McpClickHouseConnector`). No OpenAI, Anthropic, LangChain, or Agent Builder.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│              packages/web (React — Dashboard, Ask, Catalog)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS / REST
┌──────────────────────────────▼──────────────────────────────────────┐
│                       API Layer                                      │
│   packages/api (Express)                                            │
│   • GET /api/v1/greenlight — deterministic analyst + Gemini writer │
│   • POST /api/v1/agent/ask — NL→SQL for catalog_qa / stats         │
│   • POST /api/v1/media/ingest                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                   Application / Use Case Layer                       │
│   packages/core — ports, domain entities, InsightEngineService      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                 Orchestration Layer                                  │
│   packages/orchestration                                             │
│   • AgentRunner — 6-step timeline (INTENT→DISCOVER→PLAN→EXECUTE→   │
│     SYNTHESIZE→AUDIT) for catalog_qa / stats                        │
│   • GreenlightAnalyst — 4 parallel MCP SELECTs + TypeScript scorer  │
│   • SchemaCache — live system.columns (5 min TTL)                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Ports (interfaces)
┌──────────────────────────────▼──────────────────────────────────────┐
│                  Infrastructure Layer                                │
│   packages/infrastructure                                            │
│   • McpClickHouseConnector (official mcp-clickhouse)                │
│   • GeminiReasoningAdapter (@google/genai)                          │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     ClickHouse (media_catalog)                       │
│   media_content · title_revenue · agent_runs                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Greenlight Data Flow (Deterministic Analyst)

```
1. GET /api/v1/greenlight (or intent=greenlight via /ask)
   └── Skip Gemini INTENT — defaultIntent is greenlight

2. DISCOVER — 4 parallel MCP SELECT queries (no Gemini SQL):
   A. Genre inventory (title count vs 4-week revenue share)
   B. Title momentum (WoW revenue + views per title)
   C. Cannibalization (same-genre pairs in top revenue quartile)
   D. Slate holes (genre/language underserved vs revenue)

3. PLAN_SQL — TypeScript scorer (not Gemini):
   opportunity = 0.4*genre_gap + 0.4*wow_momentum - 0.2*cannibalization_penalty
   Pick top 3 with max 1 title per genre

4. EXECUTE — candidate rows passed to synthesis

5. SYNTHESIZE — single Gemini call writes narrative; titles grounded to candidates

6. AUDIT — INSERT into agent_runs via MCP
```

## Catalog Q&A Data Flow (NL→SQL)

```
1. POST /api/v1/agent/ask { question }
2. INTENT — Gemini classifies (skipped when defaultIntent provided)
3. DISCOVER — list_tables + system.columns per table (cached 5 min)
4. PLAN_SQL — Gemini generates SQL from live schema
5. EXECUTE — MCP runQuery; retry PLAN_SQL once on error or 0 rows
6. SYNTHESIZE — Gemini answer; recommendations grounded to query rows
7. AUDIT — agent_runs INSERT
```

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Monorepo, hexagonal ports |
| **@google/genai** | Intent, NL→SQL, synthesis only |
| **mcp-clickhouse** | All ClickHouse reads/writes |
| **ClickHouse** | Catalog + weekly revenue analytics |
| **React + Vite** | Dashboard, 6-step agent timeline |
| **Docker Compose** | Local ClickHouse + seed |

## Demo Seed Narrative

After `deployment/scripts/seed.sh` (or `seed-remote.sh` for ClickHouse Cloud):

- **Comedy** oversupplied with flat/negative WoW
- **Thriller** under-indexed on title count vs revenue share
- **True Crime: Highway 101** + **Redux** — cannibal pair (both penalized)
- **Crimen sin Fronteras: Bogotá** — LATAM breakout with rising WoW (should greenlight)

Regenerate SQL: `node deployment/scripts/generate-seed-catalog.mjs`
