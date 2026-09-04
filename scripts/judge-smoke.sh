#!/usr/bin/env bash
# Full judge-path QA smoke for Catalog Greenlight (health + greenlight + ask + /judge).
#
# NOT for judging-week cron — use keepalive-smoke.sh (health + cached greenlight only).
# Cold start on Render free tier can flake; retries are expected and OK.
#
# Usage:
#   bash scripts/judge-smoke.sh
#   BASE_URL=https://catalog-greenlight.onrender.com bash scripts/judge-smoke.sh
#   MAX_ASK_ATTEMPTS=3 ASK_TIMEOUT_SEC=240 bash scripts/judge-smoke.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/smoke-common.sh
source "${SCRIPT_DIR}/smoke-common.sh"

ASK_QUESTION="${ASK_QUESTION:-Which genre is under-represented in our catalog?}"
MAX_ASK_ATTEMPTS="${MAX_ASK_ATTEMPTS:-3}"
ASK_TIMEOUT_SEC="${ASK_TIMEOUT_SEC:-240}"
ASK_RETRY_SLEEP_SEC="${ASK_RETRY_SLEEP_SEC:-20}"

echo "== Catalog Greenlight judge smoke =="
echo "   base: ${BASE_URL}"
echo "   ask retries: up to ${MAX_ASK_ATTEMPTS} (cold-start tolerant)"
echo

smoke_wait_health_ready
smoke_assert_greenlight

echo
echo "ask  POST /api/v1/agent/ask"
ask_json=""
for attempt in $(seq 1 "${MAX_ASK_ATTEMPTS}"); do
  echo "ask attempt ${attempt}/${MAX_ASK_ATTEMPTS}  (timeout ${ASK_TIMEOUT_SEC}s)"
  set +e
  ask_json="$(curl -sS --max-time "${ASK_TIMEOUT_SEC}" -X POST "${BASE_URL}/api/v1/agent/ask" \
    -H 'Content-Type: application/json' \
    -d "{\"question\":\"${ASK_QUESTION}\"}")"
  curl_exit=$?
  set -e

  if [ "${curl_exit}" -ne 0 ]; then
    echo "   curl failed (exit ${curl_exit})"
    if [ "${attempt}" -eq "${MAX_ASK_ATTEMPTS}" ]; then
      echo "   FAIL ask after ${MAX_ASK_ATTEMPTS} attempts" >&2
      exit 1
    fi
    echo "   waiting ${ASK_RETRY_SLEEP_SEC}s before retry (cold start)..."
    sleep "${ASK_RETRY_SLEEP_SEC}"
    continue
  fi

  if python3 - <<'PY' "${ask_json}"
import json, sys
data = json.loads(sys.argv[1])
blob = json.dumps(data).lower()
assert "gap_score" in blob, "response missing gap_score"
has_sql = bool(data.get("sql")) or "select" in blob
assert has_sql, "response missing sql field or SELECT evidence"
answer = data.get("answer") or ""
print(f"   PASS ask — intent={data.get('intent')} fallback={data.get('fallback')}")
print(f"      answer: {answer[:120]}{'…' if len(answer) > 120 else ''}")
if data.get("sql"):
    sql_preview = data["sql"].replace("\n", " ")[:100]
    print(f"      sql: {sql_preview}…")
PY
  then
    break
  fi

  if [ "${attempt}" -eq "${MAX_ASK_ATTEMPTS}" ]; then
    echo "   FAIL ask assertions after ${MAX_ASK_ATTEMPTS} attempts" >&2
    echo "${ask_json}"
    exit 1
  fi
  echo "   assertions failed; waiting ${ASK_RETRY_SLEEP_SEC}s before retry..."
  sleep "${ASK_RETRY_SLEEP_SEC}"
done

echo
echo "judge page  GET /judge"
judge_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 60 "${BASE_URL}/judge")"
if [ "${judge_code}" != "200" ]; then
  echo "   FAIL /judge HTTP ${judge_code} (expected 200)" >&2
  exit 1
fi
echo "   PASS /judge HTTP 200"

echo
echo "ALL PASS"
