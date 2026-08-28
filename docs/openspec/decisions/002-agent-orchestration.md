# ADR-002: Agent Orchestration with AgentRunner

**Status:** Accepted  
**Date:** 2026-08-28  
**Authors:** Architecture Team  

## Context

We need deterministic, multi-step agent workflows that:

1. Use **@google/genai** for reasoning (no Agent Builder / ADK)
2. Query ClickHouse **only** via official `mcp-clickhouse`
3. Expose a **6-step timeline** judges can verify (INTENT → DISCOVER → PLAN_SQL → EXECUTE → SYNTHESIZE → AUDIT)
4. Separate **measurement** from **narration** for weekly greenlight picks

## Decision

Use a custom **`AgentRunner`** in `packages/orchestration` — explicit step functions, no LangGraph or LangChain.

### Greenlight path (deterministic analyst)

- Four fixed `SELECT` queries run in parallel during DISCOVER
- `GreenlightScorer` in TypeScript scores titles and picks top 3 with genre diversity
- Gemini is called **once** in SYNTHESIZE to write copy grounded to candidate rows

### Catalog Q&A / stats path (NL→SQL)

- DISCOVER loads live schema from `system.columns` (5-minute cache)
- Gemini generates SQL from that schema; one retry on execute failure or empty result
- INTENT skipped when `defaultIntent` is provided (`greenlight`, `stats`, `ingest`)

### Step responsibilities

| Step | Greenlight | catalog_qa / stats |
|------|------------|-------------------|
| INTENT | Skipped (default) | Gemini classify (optional skip) |
| DISCOVER | 4 analytics SELECTs | Live schema |
| PLAN_SQL | TypeScript scorer | Gemini SQL |
| EXECUTE | Candidate rows | MCP runQuery (+ retry) |
| SYNTHESIZE | Gemini writer | Gemini answer (grounded) |
| AUDIT | agent_runs INSERT | agent_runs INSERT |

## Consequences

- **Positive:** Judges see SQL + row evidence; greenlight picks are reproducible from seed data
- **Positive:** No disqualifying frameworks; single Gemini partner for runtime AI
- **Negative:** Two code paths to maintain (greenlight vs NL→SQL)

## Rationale

Hackathon requires a multi-step agent that solves enterprise friction. A TypeScript analyst with Gemini as writer demonstrates **measured** programming decisions — the product pitch for Catalog Greenlight.
