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
# sign-off exhibits: fresh approvals always carry them (0005 ships with this code)
echo "$record" | grep -q "<svg"
echo "$record" | grep -q "recorded at sign-off, not reconstructed at read time"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/record/999999")" = 404 ]

echo "== a portfolio slice recomputes from policy rows"
slice=$(gql human '{"query":"query { portfolioSlice(filters: [{field: \"driver_age\", lo: 18, hi: 24}]) { rows exposure claims exposureSharePct charts { kind } } }"}')
slice_rows=$(echo "$slice" | jq -r '.data.portfolioSlice.rows')
[ "$slice_rows" -gt 0 ]
echo "$slice" | jq -e '.data.portfolioSlice.charts | map(.kind) | index("slice_age")' > /dev/null
echo "   slice holds $slice_rows policies"

echo "== the drill bottoms out in paginated records"
records=$(gql human '{"query":"query { sliceRecords(filters: [{field: \"driver_age\", lo: 18, hi: 24}], offset: 0, limit: 5) { total policies { policyId driverAge } } }"}')
rec_total=$(echo "$records" | jq -r '.data.sliceRecords.total')
[ "$rec_total" = "$slice_rows" ]
echo "$records" | jq -e '.data.sliceRecords.policies | length == 5' > /dev/null
echo "$records" | jq -e '[.data.sliceRecords.policies[].driverAge] | all(. >= 18 and . <= 24)' > /dev/null
echo "   $rec_total records, first page filtered correctly"

echo "== hostile slice fields are rejected, not interpolated"
bad=$(gql human '{"query":"query { portfolioSlice(filters: [{field: \"policy_id; DROP TABLE policies\", lo: 1}]) { rows } }"}' | jq -r '.errors[0].message // empty')
[ -n "$bad" ]
echo "   refused: $bad"

echo "== smoke passed: run $run_id approved as v$version, record serves, slices drill"
