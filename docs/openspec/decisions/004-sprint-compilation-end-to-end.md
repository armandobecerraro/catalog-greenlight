# ADR-004: Sprint de Compilación y Demo Funcional End-to-End

**Status:** Accepted  
**Date:** 2026-08-28  
**Authors:** Architecture Team  

## Context

El repositorio debía compilar, probar y demostrar un flujo agentic end-to-end para el hackathon Agentic Cinema (track ClickHouse), con:

1. Greenlight determinístico (scorer TypeScript + 4 queries MCP)
2. NL→SQL para catalog_qa con schema live y retry
3. Seed demo con narrativa verificable (~200 títulos, 8+ semanas)
4. Tests unitarios y E2E Playwright

## Decision

### Fase 1: Core + Infrastructure

- Puertos hexagonales en `@bas/core`
- `McpClickHouseConnector` + `GeminiReasoningAdapter` (`@google/genai`)

### Fase 2: Orchestration (sin LangGraph)

- `AgentRunner` — 6 pasos explícitos
- `GreenlightAnalyst` + `GreenlightScorer` — analista determinístico
- `SchemaCache` — `system.columns`, TTL 5 min

### Fase 3: API + Web

- `GET /api/v1/greenlight` → `runGreenlight()`, cache 10 min
- Dashboard: stats primero, greenlight async
- Timeline de 6 pasos en `/ask` y panel greenlight

### Fase 4: Seed demo

- `deployment/scripts/generate-seed-catalog.mjs` → `seed-catalog.sql`
- `seed.sh` (Docker) y `seed-remote.sh` (ClickHouse Cloud)

### Fase 5: Pruebas

- `GreenlightScorer.test.ts` — fixtures demo story
- `AgentRunner.test.ts` — retry, schema cache, skip intent, runGreenlight
- Playwright — 6 pasos, SQL, 3 títulos en dashboard

## Consequences

- **Positive:** Repo compilable, testeable, demo con historia plantada para jurado
- **Negative:** Mantener generador de seed al evolucionar el schema

## Rationale

Un greenlight que “vibea” tres títulos no compite en el track ClickHouse. Medición explícita + evidencia MCP es el diferenciador del producto.
