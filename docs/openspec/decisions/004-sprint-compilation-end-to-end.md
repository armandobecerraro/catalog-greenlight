# ADR-004: Sprint de Compilación y Demo Funcional End-to-End

**Status:** Accepted  
**Date:** 2026-08-25  
**Authors:** Architecture Team  

## Context

El repositorio actual presenta múltiples bloqueos que impiden compilar, probar y ejecutar la plataforma:

1. **Imports rotos en `packages/core`**: Rutas relativas incorrectas entre `ports/inbound`, `ports/outbound`, `services` y `domain/entities`
2. **API desactualizada de LangGraph**: `MediaIngestionAgent.ts` usa una API antigua de `@langchain/langgraph` (v0.0.20) con `StateGraph({ channels: ... })` que ya no existe
3. **Agente sin uso real**: `IngestionWorkflow.ts` contiene nodos placeholder sin lógica real
4. **Circular import en API**: `packages/api/src/index.ts` importa `ContentIngestionUseCase` y `MediaIngestionService` desde `@bas/infrastructure` cuando están definidas en `@bas/core`
5. **API de ClickHouse v1**: `ClickHouseConnector.ts` usa `resultSet.json()` y `resultSet.stream()` que pueden no coincidir con la API real del cliente v1
6. **Sin demo ejecutable**: El ejemplo `content-ingestion.ts` depende de un servidor ClickHouse local que no está configurado
7. **Cobertura de pruebas mínima**: Solo 2 tests unitarios en `core`, sin tests en `infrastructure`, `orchestration` ni `api`
8. **Sin CI/CD funcional**: El workflow de GitHub Actions está vacío

El concurso requiere un repositorio **compilable, testeable y demo-ejecutable** para el 9 de septiembre de 2026.

## Decision

Ejecutar un sprint de corrección integral con las siguientes tareas:

### Fase 1: Corrección de Compilación (Core + Infrastructure)

| Archivo | Problema | Solución |
|---------|----------|----------|
| `core/src/ports/inbound/IContentIngestionUseCase.ts` | Rutas `'../services/MediaIngestionService'` y `'../entities/MediaContent'` incorrectas | Cambiar a `'../../services/MediaIngestionService'` y `'../../domain/entities/MediaContent'` |
| `core/src/ports/outbound/IConnector.ts` | Ruta `'../types'` incorrecta | Cambiar a `'../../types'` |
| `core/src/services/MediaIngestionService.ts` | Rutas `'../entities/MediaContent'` y `'../types'` incorrectas | Cambiar a `'../domain/entities/MediaContent'` y `'../../types'` |
| `core/src/services/MediaIngestionService.ts` | `DomainError` importado pero no usado | Remover import no usado |
| `infrastructure/src/partners/clickhouse/ClickHouseConnector.ts` | API de streaming desactualizada | Actualizar a API compatible con `@clickhouse/client` v1 |

### Fase 2: Actualización de LangGraph

| Archivo | Problema | Solución |
|---------|----------|----------|
| `orchestration/src/agents/MediaIngestionAgent.ts` | API antigua de `StateGraph` con `channels` | Reescribir usando API moderna: `StateGraph({ stateSchema })` con `addNode` que recibe estado parcial |
| `orchestration/src/agents/MediaIngestionAgent.ts` | Define `AgentState` local (duplicado) | Usar el `AgentState` central en `src/state/AgentState.ts` |
| `orchestration/src/workflows/IngestionWorkflow.ts` | Nodos placeholder sin lógica | Implementar `GeminiAgentNode` con llamada real a Gemini y `ClickHouseStorageNode` con inserción real |

### Fase 3: Corrección de API Layer

| Archivo | Problema | Solución |
|---------|----------|----------|
| `api/src/index.ts` | Imports incorrectos desde `@bas/infrastructure` | Cambiar imports de `ContentIngestionUseCase`, `MediaIngestionService`, `ClickHouseConnector`, `ConnectorFactory` a `@bas/core` e `@bas/infrastructure` según corresponda |
| `api/src/index.ts` | `ConnectorFactory.create()` es async pero se usa síncrono | Hacer asincrónica la inicialización del servidor |

### Fase 4: Integración Gemini Real

Implementar un cliente Gemini mínimo que use `@langchain/google-genai` para generar:
- Resumen de contenido
- Tags automáticos
- Sentimiento

### Fase 5: Pruebas

- Tests unitarios para `ContentIngestionUseCase`
- Tests unitarios para `ClickHouseConnector` (mock del cliente)
- Tests unitarios para `MediaIngestionAgent` (mock de Gemini)
- Tests de integración para API (`supertest`)

### Fase 6: Demo Ejecutable sin ClickHouse

Crear un modo `--dry-run` en el ejemplo que:
- No requiera ClickHouse conectado
- Use un connector mock que imprima el SQL generado
- Demuestre el flujo completo: validación → enriquecimiento → almacenamiento simulado

## Consequences

- **Positive:** El proyecto compila, tiene tests, y tiene un demo ejecutable que los jueces pueden correr
- **Negative:** Tiempo de desarrollo significativo (~4-6 horas), pero necesario para el concurso
- **Risk:** Cambios en la API de LangGraph pueden requerir ajustes adicionales

## Rationale

Un repositorio que no compila no puede ser evaluado. Este sprint elimina todos los bloqueos de compilación y agrega un demo funcional que demuestra la arquitectura enterprise a los jueces.
