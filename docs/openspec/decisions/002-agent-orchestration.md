# ADR-002: Agent Orchestration with LangGraph

**Status:** Accepted  
**Date:** 2026-08-21  
**Authors:** Architecture Team  

## Context

We need to build deterministic, multi-step agent workflows that:
1. Integrate with Gemini Enterprise Agent Platform
2. Connect to partner data sources via MCP
3. Maintain state across long-running media workflows
4. Support human-in-the-loop for production safety

## Decision

Use **LangGraph** for agent orchestration with a custom state management layer.

### Architecture Pattern

```
┌─────────────────────────────────────────────┐
│            Orchestration Layer              │
│  ┌───────────────────────────────────────┐  │
│  │  AgentGraph (LangGraph State Machine) │  │
│  │  ┌─────┐  ┌─────┐  ┌─────────────┐  │  │
│  │  │Node │→│Node │→│Human-in-loop │  │  │
│  │  └─────┘  └─────┘  └─────────────┘  │  │
│  └───────────────────────────────────────┘  │
│              ↕ Ports (interfaces)            │
├─────────────────────────────────────────────┤
│            Domain Layer (core)               │
│  MediaWorkflow, AgentTask, ConnectorResult  │
└─────────────────────────────────────────────┘
```

### State Schema

```typescript
interface AgentState {
  workflowId: string;
  currentStep: number;
  context: Record<string, unknown>;
  artifacts: MediaArtifact[];
  errors: AgentError[];
  partnerData: PartnerResponse[];
}
```

### Node Responsibilities

| Node Type | Purpose | Example |
|-----------|---------|---------|
| **Agent Node** | LLM reasoning | Gemini content analysis |
| **Tool Node** | External API call | ClickHouse query |
| **Conditional** | Branching logic | Approval gate |
| **Human Node** | Review/prompt | Content moderator approval |

## Consequences

- **Positive:** Visualizable workflows; deterministic replay; production safety
- **Negative:** Learning curve for LangGraph; state serialization overhead

## Rationale

Hackathon requires "deterministic, multi-step agent that solves enterprise friction." LangGraph provides explicit state machines and human-in-the-loop, directly satisfying this requirement.
