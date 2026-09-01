#!/bin/bash
# Apply seed-catalog.sql to a remote ClickHouse (ClickHouse Cloud or self-hosted).
# Requires clickhouse-client on PATH.
# ClickHouse Cloud: CLICKHOUSE_PORT=8443 CLICKHOUSE_SECURE=true
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

: "${CLICKHOUSE_HOST:?Set CLICKHOUSE_HOST}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"
CLICKHOUSE_SECURE="${CLICKHOUSE_SECURE:-false}"

# clickhouse client uses native protocol (9440 TLS), not HTTP (8443).
CLIENT_PORT="$CLICKHOUSE_PORT"
if [[ "$CLICKHOUSE_SECURE" == "true" || "$CLICKHOUSE_SECURE" == "1" ]]; then
  if [[ "$CLIENT_PORT" == "8443" ]]; then
    CLIENT_PORT=9440
  fi
fi

CH_ARGS=(
  --host "$CLICKHOUSE_HOST"
  --port "$CLIENT_PORT"
  --user "$CLICKHOUSE_USER"
)
if [[ -n "$CLICKHOUSE_PASSWORD" ]]; then
  CH_ARGS+=(--password "$CLICKHOUSE_PASSWORD")
fi
if [[ "$CLICKHOUSE_SECURE" == "true" || "$CLICKHOUSE_SECURE" == "1" ]]; then
  CH_ARGS+=(--secure)
fi

ch() {
  if command -v clickhouse-client >/dev/null 2>&1; then
    clickhouse-client "${CH_ARGS[@]}" "$@"
  elif command -v clickhouse >/dev/null 2>&1; then
    clickhouse client "${CH_ARGS[@]}" "$@"
  else
    echo "Install clickhouse-client or brew install --cask clickhouse" >&2
    exit 1
  fi
}

echo "Target: ${CLICKHOUSE_HOST}:${CLIENT_PORT} (secure=${CLICKHOUSE_SECURE}, app port=${CLICKHOUSE_PORT})"

echo "Applying schema..."
ch --multiquery < deployment/docker/init-schema.sql

ch --query "ALTER TABLE media_catalog.media_content ADD COLUMN IF NOT EXISTS language String DEFAULT 'en'" || true

echo "Seeding ~200 titles (run generator if needed)..."
node deployment/scripts/generate-seed-catalog.mjs
ch --multiquery < deployment/docker/seed-catalog.sql

echo "Done. Titles:"
ch --query "SELECT count() FROM media_catalog.media_content"
