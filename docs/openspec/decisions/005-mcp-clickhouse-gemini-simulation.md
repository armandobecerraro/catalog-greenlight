# ADR 005: mcp-clickhouse + Gemini Runtime Integration

**Status:** Accepted  
**Date:** 2026-08-26  
**Last revised:** 2026-09-06 — SDK/model bullets aligned with the shipped `@google/genai` client and `gemini-flash-latest` alias

## Context

Catalog Greenlight (Agentic Cinema — ClickHouse track) must query ClickHouse at runtime **only** via the official [mcp-clickhouse](https://github.com/ClickHouse/mcp-clickhouse) MCP server, and call Google Gemini via an approved SDK.

## Decision

### ClickHouse MCP

- Spawn: `uv run --with mcp-clickhouse --python 3.13 mcp-clickhouse`
- Connector: `packages/infrastructure/src/partners/clickhouse/McpClickHouseConnector.ts`
- Tools used: `run_query`, `list_databases`, `list_tables`
- Result format: JSON `{"columns":[...],"rows":[[...]]}` parsed to row objects
- HTTP port **8123** (never 9000 for MCP)
- Seed/init uses Docker `clickhouse-client` only (no Node ClickHouse client in the repo)

### Gemini

- SDK: `@google/genai` (official `GoogleGenAI` client — **not** `@google/generative-ai`, Agent Builder, ADK, or Vertex function-calling frameworks)
- Auth modes:
  - **Vertex AI (hosted / GCP credits):** `GOOGLE_GENAI_USE_VERTEXAI=true` + `GOOGLE_CLOUD_PROJECT` + `GOOGLE_CLOUD_LOCATION` + ADC / `GOOGLE_APPLICATION_CREDENTIALS_JSON` → `new GoogleGenAI({ vertexai: true, project, location })`
  - **AI Studio apiKey (local/dev fallback):** `GEMINI_API_KEY` when Vertex env is unset → `new GoogleGenAI({ apiKey })`
- Enrichment: `GeminiEnrichmentAdapter.ts` — `GoogleGenAI` + `ai.generateContent`
- Agent reasoning: `GeminiReasoningAdapter.ts` — intent, SQL, synthesis
- Model: `gemini-flash-latest` alias by default (env `GEMINI_MODEL`); `generateContent.ts` rotates through `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-3.5-flash-lite` fallbacks before surfacing an error
- **No runtime fake:** `resolveGeminiApiKey()` throws if neither Vertex nor an AI Studio key is configured
- `FakeGeminiEnrichmentClient` — unit tests only (injected)

### Agent

- `AgentRunner` in `packages/orchestration` — 6 deterministic steps exposed in UI timeline
- No LangChain / LangGraph (disqualifying per hackathon rules)

## Consequences

- Judges can grep for `callTool`, `run_query`, `GoogleGenAI`, `ai.generateContent`, `vertexai: true`
- Demo prefers Vertex so GCP billing credits fund `/ask`; AI Studio key remains for local without Vertex env
- Product API and web always use real Gemini + MCP
