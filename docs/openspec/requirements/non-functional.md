# Non-Functional Requirements

## NFR-001: Performance

- Agent response time (p95): < 2 seconds for tool-calling workflows
- Media ingestion throughput: > 1000 records/minute via ClickHouse batch inserts
- Concurrent agent executions: Support 50+ parallel workflows on Cloud Run

## NFR-002: Security

- All partner credentials in **Google Secret Manager** (never in code)
- Workload Identity Federation for service-to-service authentication
- MCP servers run with least-privilege IAM roles
- All API endpoints require JWT/OAuth2 validation

## NFR-003: Observability

- Structured JSON logging via Winston/Pino
- Distributed tracing with OpenTelemetry → Cloud Trace
- Metrics export to Cloud Monitoring
- Error tracking with context preservation across agent steps

## NFR-004: Reliability

- Agent state persisted in Cloud SQL (PostgreSQL)
- Idempotent workflow execution (safe retries)
- Circuit breakers on all external partner calls
- Graceful degradation when partner services are unavailable

## NFR-005: Maintainability

- 100% TypeScript strict mode
- Unit test coverage: > 80%
- Integration tests for all partner adapters
- Documentation as code (OpenSpec, typedoc)

## NFR-006: Scalability

- Horizontal scaling via Cloud Run (0 to N instances)
- Connection pooling for database and partner clients
- Async message queues (Pub/Sub) for decoupled workflows
