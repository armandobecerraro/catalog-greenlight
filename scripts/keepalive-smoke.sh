#!/usr/bin/env bash
# Credential-free keep-alive / judging-week smoke.
# Usage: bash scripts/keepalive-smoke.sh
#        BASE_URL=https://catalog-greenlight.onrender.com bash scripts/keepalive-smoke.sh
set -euo pipefail

BASE_URL="${BASE_URL:-https://catalog-greenlight.onrender.com}"
BASE_URL="${BASE_URL%/}"

echo "== health  ${BASE_URL}/api/v1/health"
curl -sS --max-time 120 "${BASE_URL}/api/v1/health"
echo
echo
echo "== greenlight  ${BASE_URL}/api/v1/greenlight"
curl -sS --max-time 180 "${BASE_URL}/api/v1/greenlight"
echo
