# ADR 005: mcp-clickhouse + Gemini Runtime Integration

**Status:** Accepted  
**Date:** 2026-08-26

## Context

Catalog Greenlight (Agentic Cinema — ClickHouse track) must query ClickHouse at runtime **only** via the official [mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse) MCP server, and call Google Gemini via an approved SDK.

## Decision

### ClickHouse MCP

- Spawn: `uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse`
- Connector: `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts`
- Tools used: `run_query`, `list_databases`, `list_tables`
- Result format: JSON `{"columns":[...],"rows":[[...]]}` parsed to row objects
- HTTP port **8123** (never 9000 for MCP)
- `@clickhouse/client` reserved for Docker seed/init scripts only

### Gemini

- SDK: `@google/generative-ai`
- Enrichment: `GeminiEnrichmentAdapter.ts` — `GoogleGenerativeAI` + `generateContent`
- Agent reasoning: `GeminiReasoningAdapter.ts` — intent, SQL, synthesis
- Model: `gemini-2.0-flash` (env `GEMINI_MODEL`)
- **No runtime fake:** `resolveGeminiApiKey()` throws if key missing
- `FakeGeminiEnrichmentClient` — unit tests only (injected)

### Agent

- `AgentRunner` in `packages/orchestration` — 6 deterministic steps exposed in UI timeline
- No LangChain / LangGraph (disqualifying per hackathon rules)

## Consequences

- Judges can grep for `callTool`, `run_query`, `GoogleGenerativeAI`, `generateContent`
- Demo requires `GEMINI_API_KEY`
- Product API and web always use real Gemini + MCP
