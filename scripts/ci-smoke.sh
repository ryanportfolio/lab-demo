#!/usr/bin/env bash
# The approve flow end to end against a live server and a real Postgres:
# start a run, wait for it to land, verify the agent role is refused at the
# approve gate, approve as the human, and check the decision record serves.
# This is the DB-boundary coverage unit tests cannot give (live query decode,
# the approval transaction, the record endpoint's SQL).
set -euo pipefail
BASE="${1:-http://localhost:8080}"

gql() { # $1 = role, $2 = query json
  curl -sf -X POST "$BASE/graphql" \
    -H 'content-type: application/json' \
    -H "x-actor-role: $1" \
    -d "$2"
}

echo "== start a run"
run_id=$(gql human '{"query":"mutation { startRun { id } }"}' | jq -r '.data.startRun.id')
[ -n "$run_id" ] && [ "$run_id" != null ]
echo "   run $run_id"

echo "== wait for the run to complete"
status=
for i in $(seq 1 90); do
  status=$(gql human "{\"query\":\"query { run(id: \\\"$run_id\\\") { status } }\"}" | jq -r '.data.run.status')
  [ "$status" = complete ] && break
  if [ "$status" = failed ]; then echo "run failed"; exit 1; fi
  sleep 3
done
if [ "$status" != complete ]; then echo "run never completed (last: $status)"; exit 1; fi

echo "== fetch the review"
review_id=
for i in $(seq 1 20); do
  review_id=$(gql human "{\"query\":\"query { review(runId: \\\"$run_id\\\") { id } }\"}" | jq -r '.data.review.id // empty')
  [ -n "$review_id" ] && break
  sleep 2
done
[ -n "$review_id" ]
echo "   review $review_id"

echo "== the agent role must be refused at the approve gate"
agent_err=$(gql agent "{\"query\":\"mutation { approveReview(reviewId: \\\"$review_id\\\") { version } }\"}" | jq -r '.errors[0].message // empty')
[ -n "$agent_err" ]
echo "   refused: $agent_err"

echo "== human approves"
version=$(gql human "{\"query\":\"mutation { approveReview(reviewId: \\\"$review_id\\\") { version } }\"}" | jq -r '.data.approveReview.version')
[ "$version" -ge 13 ]
echo "   created v$version"

echo "== the decision record serves from database rows"
record=$(curl -sf "$BASE/record/$run_id")
echo "$record" | grep -q "assembled from platform records"
echo "$record" | grep -q "Frozen inside the approval transaction"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/record/999999")" = 404 ]

echo "== smoke passed: run $run_id approved as v$version, record serves"
