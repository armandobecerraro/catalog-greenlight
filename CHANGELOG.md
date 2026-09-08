# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `docs/submission/JUDGING_OPS.md` — operations and contingency plan for the judging window (Sep 23 – Oct 7, 2026).
- `.dockerignore` — keeps `.env` and `node_modules` out of the Docker build context (faster, secret-safe builds).
- Adversarial SQL-injection regression tests for `escapeSqlLiteral` and the audit INSERT path.

### Changed
- `render.yaml` aligns `GEMINI_MODEL` with the code/docs default `gemini-flash-latest` (was pinned `gemini-2.0-flash`).
- ADR-005 updated to the shipped `@google/genai` SDK, `gemini-flash-latest` alias, and model fallback chain.
- `HOSTED_SMOKE.md` annotates the historical `gemini-2.0-flash` health evidence vs. the current alias default.
- `JURY_EVIDENCE.md` now describes the hardened audit INSERT escaping instead of flagging an injection risk.

### Security
- `escapeSqlLiteral` now escapes backslashes before doubling single quotes, closing the ClickHouse `\'` literal-termination path in audit INSERTs and catalog INSERTs (`sqlEscape.ts`, `McpAgentAuditAdapter.ts`, `McpCatalogRepository.ts`).

## [0.1.0] - 2026-08-21

### Added
- Initial repository structure with Clean Architecture and DDD
- Core domain layer (entities, value objects, ports)
- Infrastructure layer with Google Cloud and partner adapters
- Orchestration layer for agent workflows
- REST API layer
- OpenSpec documentation framework
- Docker and Kubernetes deployment manifests
- CI/CD pipelines with GitHub Actions

### Changed (since 0.1.0, via git history)
- Greenlight pipeline hardened: deterministic TypeScript scorer, genre diversity, anti-filler filters, resilient Gemini fallbacks
- `/judge` landing, `/ask` agent transparency (6-step timeline), `/ingest`, `/guia`
- 100% unit test coverage enforced per workspace (Jest), Playwright E2E suite
- Docker deployment via Render blueprint with ClickHouse Cloud (8443, TLS)
- Live demo at https://catalog-greenlight.onrender.com with judge smoke scripts