# ADR-001: Clean Architecture with Domain-Driven Design

**Status:** Accepted  
**Date:** 2026-08-21  
**Authors:** Architecture Team  

## Context

We need an architecture that:
1. Enforces strict separation of concerns for long-term maintainability
2. Allows swapping infrastructure (Google Cloud, Partners) without touching business logic
3. Scales from prototype to production for the hackathon timeline
4. Demonstrates enterprise-grade engineering to judges

## Decision

Adopt **Clean Architecture** (Onion Architecture) combined with **Domain-Driven Design (DDD)**.

### Layer Responsibilities

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Domain** | `packages/core/src/domain` | Entities, value objects, domain events, business rules |
| **Ports** | `packages/core/src/ports` | Interfaces defining contracts (inbound/outbound) |
| **Services** | `packages/core/src/services` | Domain services, application use cases |
| **Infrastructure** | `packages/infrastructure/src` | External integrations (Gemini, ClickHouse, MCP) |
| **Orchestration** | `packages/orchestration/src` | Agent workflows, state machines, LangGraph |
| **API** | `packages/api/src` | Controllers, middleware, routing |

### Dependency Rule

All dependencies point **inward**. Domain has zero external dependencies. Infrastructure depends on Domain (via ports), never the reverse.

## Consequences

- **Positive:** Testable business logic in isolation; easy partner swaps; clear onboarding
- **Negative:** Initial boilerplate is higher; requires discipline in PR reviews

## Rationale

This directly addresses hackathon judging criteria:
- **Technological Implementation:** Production patterns, not spaghetti code
- **Design:** Coherent product experience through layered architecture
- **Quality of Idea:** Deterministic, multi-step agent orchestration with governance
