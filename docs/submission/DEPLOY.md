# Deployment — Catalog Greenlight

Judges need a **live URL** through at least judging (~23 Sep – 7 Oct 2026).

## Option A: Render (recommended, free tier)

**Prerequisites:** ClickHouse Cloud service (HTTP 8123/8443) + `GEMINI_API_KEY`

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
  --set-env-vars GEMINI_MODEL=gemini-2.0-flash,CLICKHOUSE_PORT=8443,CLICKHOUSE_SECURE=true,... \
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
curl -s https://<YOUR_URL>/api/v1/health | jq .
curl -s https://<YOUR_URL>/api/v1/catalog/stats | jq .
```

## Keep-alive checklist

- [ ] Render/Cloud Run service not sleeping (upgrade plan if free tier sleeps)
- [ ] ClickHouse Cloud credits active through Oct 7
- [ ] `GEMINI_API_KEY` quota sufficient
- [ ] Re-run seed if catalog empty after redeploy
