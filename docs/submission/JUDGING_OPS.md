# Judging window operations (Sep 23 – Oct 7, 2026)

Live demo: https://catalog-greenlight.onrender.com  
Full checklist for judges: `docs/submission/JURY_EVIDENCE.md`  
This file is the **runbook**: what keeps the demo alive and what to do when something breaks.

## Live dependencies (all external)

| Dependency | Role | Risk if it dies |
| --- | --- | --- |
| Render free-tier web service | Serves the whole demo | Spin-down after ~15 min idle → 35–90 s cold start (measured ~35 s warm-ish, 2026-09-06) |
| ClickHouse Cloud trial | All measured analytics + audit table | Greenlight / ask cannot measure → demo dead |
| Gemini API prepaid credits | `/ask` synthesis + NL→SQL, `/ingest` enrichment, greenlight narrative | Falls back to scorer + fallback SQL (HTTP 200) — **greenlight still works** |

## Current status snapshot (2026-09-06)

- **ClickHouse Cloud:** OK — live check passed (`328` titles, connect OK).
- **Gemini:** ❌ **prepaid credits depleted** — API returns `429 RESOURCE_EXHAUSTED` ("Your prepayment credits are depleted"). Effects:
  - `/ask` and `/ingest` degrade to the built-in fallbacks (still HTTP 200; verified by `judge-smoke.sh` on 2026-09-06 — answer cites live `gap_score`, `fallback=True`).
  - Greenlight ranking is unaffected (TypeScript scorer).
  - **ACTION (owner): top up Gemini prepaid credits before judging** at https://aistudio.google.com/apikey → Billing. Without this, judges see fallback-only behavior for `/ask` narrative and `/ingest` enrichment.
- **Model env:** `render.yaml` now sets `GEMINI_MODEL=gemini-flash-latest` (matching code + docs). The live service still reports `gemini-2.0-flash` until the Render env var / blueprint is redeployed. Apply by: Render dashboard → service → Environment → `GEMINI_MODEL=gemini-flash-latest`, or push + let the blueprint auto-deploy.

## Cadence during judging week

Run these from a machine with internet (a laptop or a cron):

1. **Keep-alive every 5–10 min** (prevents spin-down; costs no Gemini/ClickHouse writes):
   ```bash
   bash scripts/keepalive-smoke.sh
   # optional: 0/5 * * * *  cd <repo> && bash scripts/keepalive-smoke.sh >> /tmp/keepalive.log 2>&1
   ```
   This only hits `/api/v1/health` (asserts `ready:true` + clickhouse `connected`) and the **cached** greenlight. Never cron `?refresh=1` or `/agent/ask`.

2. **Full judge-path QA before each demo / every few days:**
   ```bash
   MAX_ASK_ATTEMPTS=3 bash scripts/judge-smoke.sh
   ```
   Exercises health → greenlight → `/ask` (asserts `gap_score` + SQL evidence) → `/judge` page.

3. **Credential check** (prints no secrets):
   ```bash
   npm run check:credentials
   ```

## Runbook — if a judge visits and something is broken

1. **Service asleep / cold start:** run `keepalive-smoke.sh` once; if health reports `ready:false`, wait up to ~2 min and re-run. The `/judge` page and dashboard show a cold-start banner while `ready:false`.
2. **Greenlight returns fewer than 3 picks or filler titles:** data drift in ClickHouse Cloud. Re-seed:
   ```bash
   set -a && source .env && set +a && bash deployment/scripts/seed-remote.sh
   ```
   (resets catalog + title_revenue near 200 titles; documented in `docs/submission/HOSTED_SMOKE.md`.)
3. **Gemini down (429/quota/expired key):** demo the deterministic path on purpose — ranking still returns 3 scored picks; `/ask` returns a grounded fallback answer. Present the scorer + 6-step timeline; the narrative is optional by design (`GREENLIGHT_SYNTHESIZE_TIMEOUT_MS` = 25 s fallback).
4. **ClickHouse Cloud unreachable or credits expired:** switch the demo to the local Docker path (Path B):
   ```bash
   npm run demo   # boots docker-compose ClickHouse + seed + CLI; then npm run dev
   ```
   Judges can still inspect code + docs + video even if the live DB is down.
5. **Render service fails to deploy after a code push:** roll back via Render dashboard to the last good deploy; verify with `judge-smoke.sh`.

## If the whole live demo is down for a judge visit

Fallbacks in priority order:
1. The published demo video (English, ~2:43, CC) walks the same 6-step / greenlight / ask flow.
2. Local demo path (`npm run demo` + `npm run dev`) with Docker ClickHouse.
3. `docs/submission/*.md` (JURY_EVIDENCE, HOSTED_SMOKE, VERIFICATION, COMPETITIVE_MEMO) carry timestamped evidence of the live behavior.

## Owners / contacts

- Repo + Render + video + Devpost owner: project team (see `docs/submission/VERIFICATION.md`).
- ClickHouse Cloud admin + Gemini billing: whoever holds the cloud console credentials in `.env`/Render secrets — **verify renewals before Sep 23**.