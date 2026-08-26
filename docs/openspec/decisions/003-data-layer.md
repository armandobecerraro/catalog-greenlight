# ADR-003: Multi-Partner Data Layer via MCP

**Status:** Accepted  
**Date:** 2026-08-21  
**Authors:** Architecture Team  

## Context

The hackathon requires integration with 5 partner platforms (IBM, Grafana, Parallel, ClickHouse, Replit). Each partner exposes data differently (APIs, MCP servers, databases). We need a unified access pattern that:
1. Allows runtime selection of partners
2. Enforces IAM and security boundaries
3. Supports both streaming and batch operations
4. Can be demonstrated without hardcoding partner credentials

## Decision

Implement a **Strategy Pattern** with MCP protocol adapters and a Gateway abstraction.

### Core Interfaces

```typescript
// Outbound port (Domain defines WHAT, not HOW)
export interface IConnector {
  readonly name: string;
  connect(config: ConnectionConfig): Promise<void>;
  query(request: QueryRequest): Promise<QueryResult>;
  stream(request: StreamRequest): AsyncIterable<StreamChunk>;
  disconnect(): Promise<void>;
}

// Configuration port
export interface IConnectorFactory {
  create(type: PartnerType, config: ConnectorConfig): IConnector;
}
```

### Adapter Map

| Partner | Adapter Location | Protocol |
|---------|------------------|----------|
| ClickHouse | `infrastructure/src/partners/clickhouse` | HTTP + native client |
| IBM | `infrastructure/src/partners/ibm` | watsonx SDK + MCP |
| Grafana | `infrastructure/src/partners/grafana` | MCP Server |
| Parallel | `infrastructure/src/partners/parallel` | REST API + MCP |
| Replit | `infrastructure/src/partners/replit` | Replit API + MCP |

### Security Model

- All partner credentials stored in **Google Secret Manager**
- IAM roles restrict which agents can access which connectors
- MCP servers run as isolated Cloud Run services with minimal permissions

## Consequences

- **Positive:** Swappable partners; unified testing via mocks; security by default
- **Negative:** Indirection overhead; each partner requires bespoke adapter

## Rationale

Hackathon rules require demonstrating "actual runtime use of Partner's service (imported and called in code, not just named in README)." The adapter pattern ensures real, tested integrations while keeping domain pure.
