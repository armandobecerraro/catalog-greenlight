#!/usr/bin/env bash
# Start API (8080) + Vite (5173). Loads repo-root .env via packages/api/src/loadEnv.ts.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="${HOME}/.local/bin:${PATH}"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set GEMINI_API_KEY + ClickHouse Cloud vars."
  exit 1
fi

exec npm run dev
