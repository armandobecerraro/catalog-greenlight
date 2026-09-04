#!/usr/bin/env bash
# Shared helpers for Catalog Greenlight hosted smoke scripts.
# shellcheck disable=SC2034
set -euo pipefail

BASE_URL="${BASE_URL:-https://catalog-greenlight.onrender.com}"
BASE_URL="${BASE_URL%/}"
MAX_WAKE_ATTEMPTS="${MAX_WAKE_ATTEMPTS:-6}"
WAKE_SLEEP_SEC="${WAKE_SLEEP_SEC:-15}"

smoke_wait_health_ready() {
  local health_json=""
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
      return 1
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
}

smoke_assert_greenlight() {
  echo
  echo "greenlight  GET /api/v1/greenlight"
  local greenlight_json
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
}
