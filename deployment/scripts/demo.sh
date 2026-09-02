#!/bin/bash
set -e

echo "🎬 Catalog Greenlight — Agentic Cinema Demo"
echo "============================================"

if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ] && [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
  echo "❌ GEMINI_API_KEY is required. Export your key before running npm run demo."
  exit 1
fi

export CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
export CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-8123}"
export CLICKHOUSE_USER="${CLICKHOUSE_USER:-default}"
export CLICKHOUSE_PASSWORD="${CLICKHOUSE_PASSWORD:-}"
export CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-media_catalog}"
export CLICKHOUSE_USERNAME="$CLICKHOUSE_USER"
export CLICKHOUSE_SECURE="${CLICKHOUSE_SECURE:-false}"
export CLICKHOUSE_ALLOW_WRITE_ACCESS="${CLICKHOUSE_ALLOW_WRITE_ACCESS:-true}"
export PATH="$HOME/.local/bin:$PATH"
export MCP_COMMAND="${MCP_COMMAND:-uv}"
export MCP_ARGS="${MCP_ARGS:-[\"run\", \"--with\", \"mcp-clickhouse\", \"--python\", \"3.13\", \"mcp-clickhouse\"]}"

echo ""
echo "1. Starting ClickHouse (Docker)..."
docker compose -f deployment/docker/docker-compose.clickhouse.yml up -d clickhouse 2>/dev/null || \
  docker-compose -f deployment/docker/docker-compose.clickhouse.yml up -d clickhouse

echo "   Waiting for ClickHouse..."
for i in $(seq 1 30); do
  if docker compose -f deployment/docker/docker-compose.clickhouse.yml exec -T clickhouse clickhouse-client --query "SELECT 1" >/dev/null 2>&1 || \
     docker-compose -f deployment/docker/docker-compose.clickhouse.yml exec -T clickhouse clickhouse-client --query "SELECT 1" >/dev/null 2>&1; then
    echo "   ✅ ClickHouse ready"
    break
  fi
  [ "$i" -eq 30 ] && { echo "❌ ClickHouse timeout"; exit 1; }
  sleep 2
done

echo ""
echo "2. Initializing schema..."
docker compose -f deployment/docker/docker-compose.clickhouse.yml exec -T clickhouse clickhouse-client --multiquery < deployment/docker/init-schema.sql 2>/dev/null || \
  docker-compose -f deployment/docker/docker-compose.clickhouse.yml exec -T clickhouse clickhouse-client --multiquery < deployment/docker/init-schema.sql

echo ""
echo "3. Seeding catalog (~200 titles, demo story)..."
bash deployment/scripts/seed.sh

echo ""
echo "4. Running agent demo (Gemini REAL + MCP)..."
npm run start:demo --workspace @bas/media-workflows-examples

echo ""
echo "✅ Demo complete. Run 'npm run dev' for web UI."
