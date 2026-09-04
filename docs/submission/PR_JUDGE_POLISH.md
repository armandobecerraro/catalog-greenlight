# PR draft — Judge UX polish (cold-start, Ask, docs, smoke)

**Branch:** `polish/pre-deadline-judge-ux`  
**Scope:** UI/UX + docs + smoke harness — no scorer/MCP architecture changes.

## Summary (for Devpost judges)

- **Cold-start banner** with progress/ETA; shared health poll (no N× `/health`).
- **Greenlight refresh** keeps cached slate visible while re-measuring; soft-disable until `ready`.
- **Ask**: sticky Run, scroll-to-answer, a11y textarea, grounded badge when `gap_score`/evidence exists.
- **README 60-second judge path** + synthetic catalog vs partner ingest as future work.
- **`npm run judge:smoke`** — health → 3-genre greenlight → ask `gap_score` → `/judge` 200 (cron still uses keepalive health-only).

## GitHub About (manual — repo settings)

| Field | Suggested value |
|-------|-----------------|
| **Description** | ClickHouse-track hackathon app — weekly catalog greenlight with mcp-clickhouse + TypeScript scorer |
| **Website** | https://catalog-greenlight.onrender.com |
| **Topics** | `clickhouse`, `mcp`, `gemini`, `hackathon`, `agentic-ai` |

## Risk

**Low** — UI/docs only. Ranking stays TypeScript; ClickHouse access stays mcp-clickhouse only.

## Test plan

- [ ] `npm test` (esp. `@bas/web`)
- [ ] Cold visit: warming banner with progress until `ready`
- [ ] `/` refresh slate with cache dimmed; `/ask` grounded + `gap_score`
- [ ] `/judge` readable; README 60s path
- [ ] Optional: `npm run judge:smoke` against hosted URL (cold-start retries OK)

## Deliberately skipped

- Scorer weight changes, Agent Builder, partner ingest, Render replacement, video/Devpost edits.
