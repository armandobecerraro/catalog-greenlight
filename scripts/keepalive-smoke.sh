#!/usr/bin/env bash
# Credential-free keep-alive / judging-week smoke for Catalog Greenlight.
#
# Usage:
#   bash scripts/keepalive-smoke.sh
#   BASE_URL=https://catalog-greenlight.onrender.com bash scripts/keepalive-smoke.sh
#
# During judging week (Sep 23 – Oct 7, 2026), run every 5–10 min against /api/v1/health
# to avoid Render free-tier spin-down. Do NOT ping greenlight?refresh=1 on a timer.
set -euo pipefail

BASE_URL="${BASE_URL:-https://catalog-greenlight.onrender.com}"
BASE_URL="${BASE_URL%/}"
MAX_WAKE_ATTEMPTS="${MAX_WAKE_ATTEMPTS:-6}"
WAKE_SLEEP_SEC="${WAKE_SLEEP_SEC:-15}"

echo "== Catalog Greenlight keepalive smoke =="
echo "   base: ${BASE_URL}"
echo

health_json=""
for attempt in $(seq 1 "${MAX_WAKE_ATTEMPTS}"); do
  echo "health attempt ${attempt}/${MAX_WAKE_ATTEMPTS}  GET /api/v1/health"
  health_json="$(curl -sS --max-time 120 "${BASE_URL}/api/v1/health")"
  echo "${health_json}"
  ready="$(python3 - <<'PY' "${health_json}"
import json, sys
print(json.loads(sys.argv[1]).get("ready", False))
PY
)"
  if [ "${ready}" = "True" ]; then
    echo "   PASS health ready"
    break
  fi
  if [ "${attempt}" -eq "${MAX_WAKE_ATTEMPTS}" ]; then
    echo "   FAIL health not ready after ${MAX_WAKE_ATTEMPTS} attempts" >&2
    exit 1
  fi
  echo "   waiting ${WAKE_SLEEP_SEC}s for Render cold start..."
  sleep "${WAKE_SLEEP_SEC}"
done

python3 - <<'PY' "${health_json}"
import json, sys
data = json.loads(sys.argv[1])
assert data.get("partners", {}).get("clickhouse") == "connected", data
print("   PASS clickhouse connected")
PY

echo
echo "greenlight  GET /api/v1/greenlight"
greenlight_json="$(curl -sS --max-time 240 "${BASE_URL}/api/v1/greenlight")"
python3 - <<'PY' "${greenlight_json}"
import json, sys
data = json.loads(sys.argv[1])
recs = data.get("recommendations") or []
assert len(recs) == 3, f"expected 3 recommendations, got {len(recs)}"
genres = [r.get("genre") for r in recs]
assert len(set(genres)) == 3, f"expected 3 unique genres, got {genres}"
for r in recs:
    assert r.get("opportunity_score") is not None, r
print("   PASS greenlight 3 picks, 3 genres, scored")
for i, r in enumerate(recs, 1):
    print(f"      {i}. {r.get('title')} ({r.get('genre')}) score={r.get('opportunity_score')}")
PY

echo
echo "ALL PASS"
