#!/bin/bash
# Seed Catalog Greenlight demo catalog via clickhouse-client (NOT MCP — init only)
set -e

COMPOSE_FILE="${COMPOSE_FILE:-deployment/docker/docker-compose.clickhouse.yml}"
SERVICE="${CLICKHOUSE_SERVICE:-clickhouse}"

echo "Seeding media_catalog (50 titles + revenue)..."

docker-compose -f "$COMPOSE_FILE" exec -T "$SERVICE" clickhouse-client --multiquery < deployment/docker/seed-catalog.sql

echo "Seed complete."
