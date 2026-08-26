# OpenSpec Overview

OpenSpec is the technical specification and decision framework for **Blockbuster Agentic Studio**. It captures the "why" behind architectural choices, business rules, and integration strategies.

## Structure

```
docs/openspec/
├── overview.md           # This document
├── decisions/            # Architecture Decision Records (ADRs)
│   ├── 001-architecture.md
│   ├── 002-agent-orchestration.md
│   └── 003-data-layer.md
└── requirements/         # Business and technical requirements
    ├── functional.md
    └── non-functional.md
```

## How to Use

- **Decisions** are immutable once accepted. New decisions supersede old ones.
- **Requirements** are living documents updated during sprint planning.
- Every significant change must reference an OpenSpec document.

## Naming Convention

- `001-architecture.md` → Sequential numbering
- Status: `Proposed` | `Accepted` | `Deprecated` | `Superseded`
