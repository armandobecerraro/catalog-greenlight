#!/bin/bash
# Apply seed-catalog.sql to a remote ClickHouse (ClickHouse Cloud or self-hosted).
# Requires clickhouse-client on PATH.
set -euo pipefail

: "${CLICKHOUSE_HOST:?Set CLICKHOUSE_HOST}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"

echo "Applying schema..."
clickhouse-client \
  --host "$CLICKHOUSE_HOST" \
  --port "$CLICKHOUSE_PORT" \
  --user "$CLICKHOUSE_USER" \
  --password "$CLICKHOUSE_PASSWORD" \
  --multiquery < deployment/docker/init-schema.sql

clickhouse-client \
  --host "$CLICKHOUSE_HOST" \
  --port "$CLICKHOUSE_PORT" \
  --user "$CLICKHOUSE_USER" \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "ALTER TABLE media_catalog.media_content ADD COLUMN IF NOT EXISTS language String DEFAULT 'en'" || true

echo "Seeding 50 titles..."
clickhouse-client \
  --host "$CLICKHOUSE_HOST" \
  --port "$CLICKHOUSE_PORT" \
  --user "$CLICKHOUSE_USER" \
  --password "$CLICKHOUSE_PASSWORD" \
  --multiquery < deployment/docker/seed-catalog.sql

echo "Done. Titles:" 
clickhouse-client \
  --host "$CLICKHOUSE_HOST" \
  --port "$CLICKHOUSE_PORT" \
  --user "$CLICKHOUSE_USER" \
  --password "$CLICKHOUSE_PASSWORD" \
  --query "SELECT count() FROM media_catalog.media_content"
