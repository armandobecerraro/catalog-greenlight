#!/bin/bash
# Seed Catalog Greenlight demo catalog via clickhouse-client (NOT MCP — init only)
set -e

COMPOSE_FILE="${COMPOSE_FILE:-deployment/docker/docker-compose.clickhouse.yml}"
SERVICE="${CLICKHOUSE_SERVICE:-clickhouse}"

echo "Applying schema (idempotent)..."
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --multiquery < deployment/docker/init-schema.sql 2>/dev/null || \
  docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --multiquery < deployment/docker/init-schema.sql

echo "Migrating existing tables if needed..."
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --query \
  "ALTER TABLE media_catalog.media_content ADD COLUMN IF NOT EXISTS language String DEFAULT 'en'" 2>/dev/null || \
  docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --query \
  "ALTER TABLE media_catalog.media_content ADD COLUMN IF NOT EXISTS language String DEFAULT 'en'" || true

echo "Seeding media_catalog (~200 titles, 10 weeks revenue, demo story)..."
node deployment/scripts/generate-seed-catalog.mjs 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --multiquery < deployment/docker/seed-catalog.sql 2>/dev/null || \
  docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --multiquery < deployment/docker/seed-catalog.sql

echo "Seed complete."
