# Deployment Guide

## Prerequisites

- Google Cloud SDK (`gcloud`) installed and authenticated
- Docker Desktop running
- Node.js 20+ installed

## Local Development

```bash
# 1. Clone and setup
git clone <repo-url>
cd blockbuster-agentic-studio
bash scripts/setup.sh

# 2. Start ClickHouse locally
docker compose -f deployment/docker/docker-compose.yml up -d clickhouse

# 3. Run API
npm run dev:api

# 4. Ingest demo data
npm run start:ingestion --workspace=examples/media-workflows
```

## Google Cloud Deployment

```bash
# Set project
export GOOGLE_CLOUD_PROJECT=blockbuster-agentic-studio
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Deploy
bash scripts/deploy.sh
```

## CI/CD

GitHub Actions automatically:
1. Lints code on every PR
2. Runs unit tests with 80% coverage threshold
3. Scans for security vulnerabilities (Trivy)
4. Builds Docker images on merge to main
