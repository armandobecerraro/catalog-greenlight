# Deployment — Catalog Greenlight

Judges need a **live URL** through at least judging (~23 Sep – 7 Oct 2026).

## Option A: Render (recommended, free tier)

**Prerequisites:** ClickHouse Cloud service (HTTP 8123/8443) + `GEMINI_API_KEY`

Verify credentials locally before deploying:

```bash
cp .env.example .env   # fill GEMINI_API_KEY + ClickHouse Cloud host (8443, SECURE=true)
npm run check:credentials
```

1. Push repo to public GitHub (see `VERIFICATION.md`).
2. Create [Render](https://render.com) account → **New Blueprint** → connect repo (`render.yaml` included).
3. Set secrets in Render dashboard (Blueprint defaults: `CLICKHOUSE_PORT=8443`, `CLICKHOUSE_SECURE=true` in `render.yaml`):
   - `GEMINI_API_KEY`
   - `CLICKHOUSE_HOST` (ClickHouse Cloud hostname)
   - `CLICKHOUSE_PASSWORD`
4. Deploy. Health check: `GET /api/v1/health`
5. Seed ClickHouse Cloud once (from your laptop):

```bash
CLICKHOUSE_HOST=<cloud-host> CLICKHOUSE_PASSWORD=<pwd> \
  bash deployment/scripts/seed-remote.sh
```

## ClickHouse Cloud seed

```bash
export CLICKHOUSE_HOST=your-host.clickhouse.cloud
export CLICKHOUSE_USER=default
export CLICKHOUSE_PASSWORD=your-password
export CLICKHOUSE_PORT=8443
export CLICKHOUSE_SECURE=true
./deployment/scripts/seed-remote.sh
```

`seed-remote.sh` uses native TLS on port **9440** when `CLICKHOUSE_PORT=8443` (HTTP). The app/MCP uses **8443** + `CLICKHOUSE_SECURE=true`.

Regenerate demo SQL before seeding:

```bash
node deployment/scripts/generate-seed-catalog.mjs
```

Then apply via `seed-remote.sh` or paste `deployment/docker/seed-catalog.sql` into the ClickHouse Cloud SQL console.

## Option B: Google Cloud Run + ClickHouse Cloud

```bash
gcloud builds submit --tag gcr.io/$PROJECT_ID/catalog-greenlight
gcloud run deploy catalog-greenlight \
  --image gcr.io/$PROJECT_ID/catalog-greenlight \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-flash-latest,CLICKHOUSE_PORT=8443,CLICKHOUSE_SECURE=true,... \
  --set-secrets GEMINI_API_KEY=gemini-key:latest
```

## Option C: Docker Compose (demo / private LAN)

```bash
export GEMINI_API_KEY=...
docker compose -f deployment/docker/docker-compose.prod.yml up --build
```

Open http://localhost:8080

## Post-deploy smoke

```bash
npm run check:credentials   # from laptop with same .env values as Render
curl -s https://catalog-greenlight.onrender.com/api/v1/health | jq .
curl -s https://catalog-greenlight.onrender.com/api/v1/catalog/stats | jq .
curl -s 'https://catalog-greenlight.onrender.com/api/v1/greenlight?refresh=1' | jq .
```

## Keep-alive through judging (~23 Sep – 7 Oct 2026)

Render **free** spins down after idle (~15 min). First request then takes **60–90s**. ClickHouse Cloud **trial credits may expire** before Oct 7 — if health is `ready: false` with MCP errors, check the Cloud service first.

Credential-free smoke (no secrets):

```bash
bash scripts/keepalive-smoke.sh
# or: BASE_URL=https://catalog-greenlight.onrender.com bash scripts/keepalive-smoke.sh
```

That curls `/api/v1/health` then `/api/v1/greenlight` (cached; use `?refresh=1` only when you need a fresh scorer run).

Optional ping every 5–10 min (UptimeRobot / cron) against `GET /api/v1/health` reduces spin-down during the judging window. Do **not** hammer `?refresh=1` on a timer — that re-runs four MCP queries + Gemini.

```cron
*/7 * * * * BASE_URL=https://catalog-greenlight.onrender.com bash /path/to/repo/scripts/keepalive-smoke.sh >>/tmp/cg-keepalive.log 2>&1
```

Judges: warm until `ready: true` before `/ask` or `greenlight?refresh=1` (see `/judge` checklist).

### Judging-week checklist

- [ ] Render service awake (or a keep-alive ping) through **7 Oct 2026**
- [ ] ClickHouse Cloud trial / credits active through **7 Oct 2026** (renew or export if the trial ends earlier)
- [ ] `GEMINI_API_KEY` quota sufficient (`/ask` and ingest need it; greenlight still returns 3 scorer picks on 429)
- [ ] Re-run `deployment/scripts/seed-remote.sh` if catalog empty after redeploy
- [ ] `/judge` still loads (SPA) after each Render deploy
