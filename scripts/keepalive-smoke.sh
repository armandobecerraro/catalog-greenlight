#!/usr/bin/env bash
# Credential-free keep-alive / judging-week smoke for Catalog Greenlight.
#
# Usage:
#   bash scripts/keepalive-smoke.sh
#   BASE_URL=https://catalog-greenlight.onrender.com bash scripts/keepalive-smoke.sh
#
# During judging week (Sep 23 – Oct 7, 2026), run every 5–10 min against /api/v1/health
# to avoid Render free-tier spin-down. Do NOT ping greenlight?refresh=1 on a timer.
# For full judge-path QA (ask + /judge page), use scripts/judge-smoke.sh instead.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/smoke-common.sh
source "${SCRIPT_DIR}/smoke-common.sh"

echo "== Catalog Greenlight keepalive smoke =="
echo "   base: ${BASE_URL}"
echo

smoke_wait_health_ready
smoke_assert_greenlight

echo
echo "ALL PASS"
