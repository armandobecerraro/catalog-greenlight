# Architecture Documentation

## System Overview

Blockbuster Agentic Studio is a **production-ready agentic platform** built for the Agentic Cinema hackathon. It demonstrates enterprise-grade integration of Gemini Enterprise Agent Platform with multiple partner ecosystems.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│                    (Web UI / Mobile / CLI)                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
┌──────────────────────────────▼──────────────────────────────────────┐
│                       API Gateway Layer                              │
│   packages/api (Express)                                            │
│   • REST endpoints                                                   │
│   • JWT Authentication                                               │
│   • Rate limiting                                                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                   Application / Use Case Layer                       │
│   packages/core/src/ports/inbound                                   │
│   • IContentIngestionUseCase                                        │
│   • IRecommendationUseCase                                          │
│   • IAnalyticsUseCase                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Domain Layer (Pure)                              │
│   packages/core/src/domain                                          │
│   • MediaContent (Entity)                                            │
│   • WorkflowId (Value Object)                                        │
│   • Domain Events                                                    │
│   • Business Rules (Zero external deps)                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                 Orchestration Layer                                  │
│   packages/orchestration                                             │
│   • LangGraph State Machines                                         │
│   • Agent Nodes (Gemini, Tools, Human)                               │
│   • Workflow Definitions                                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Ports (Interfaces)
┌──────────────────────────────▼──────────────────────────────────────┐
│                  Infrastructure Layer                                │
│   packages/infrastructure                                            │
│   • Google Cloud (Secret Manager, Cloud Run, Cloud SQL)              │
│   • Partner Adapters (ClickHouse, IBM, Grafana, Parallel, Replit)    │
│   • MCP Server Gateway                                               │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Media Content Ingestion

```
1. Client POST /api/v1/media/ingest
   └── { title, description, genre, releaseDate, cast }

2. API Layer validates request (Zod schema)
   └── Passes to ContentIngestionUseCase

3. Use Case creates MediaContent entity
   └── Validates invariants (title not empty, cast not empty)

4. Use Case calls MediaIngestionService.enrichWithGemini()
   └── Gemini generates summary, tags, sentiment

5. Use Case calls MediaIngestionService.ingest()
   └── ClickHouseConnector executes INSERT
   └── Returns latency, row count

6. Response returned to client
   └── { success, contentId, storedRows, partner, latencyMs }
```

## Technology Stack Rationale

| Technology | Purpose | Hackathon Alignment |
|------------|---------|---------------------|
| **TypeScript** | Type safety, enterprise patterns | Code quality judges |
| **LangGraph** | Deterministic agent workflows | Multi-step agent requirement |
| **Gemini Enterprise** | LLM reasoning | Primary platform requirement |
| **ClickHouse** | Analytics data warehouse | Partner track requirement |
| **Docker + Cloud Run** | Containerized deployment | Google Cloud requirement |
| **OpenSpec** | Technical documentation | Professional engineering |

## Scalability Strategy

- **Horizontal:** Cloud Run auto-scaling (0→N instances)
- **Data:** ClickHouse distributed clusters, connection pooling
- **State:** Cloud SQL with read replicas
- **Observability:** OpenTelemetry → Cloud Trace/Monitoring
