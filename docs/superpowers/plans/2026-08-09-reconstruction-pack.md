# Reconstruction pack — documentation as a byproduct (FR-3)

Date: 2026-08-09. Follows the agent action ledger (FR-1) and version identity
(FR-2/FR-5) builds.

## Claim being demonstrated

FR-3 from the meta-review brief: documentation must be a byproduct of the work,
recorded contemporaneously — never reconstructed at read time. The test the
brief proposes: **can one decision be reconstructed from platform records
alone?** The demo now holds every ingredient (frozen approved package, agent
action record, review narrative, guardrails, experiment ledger, version fate)
but only inside the SPA. The reconstruction pack makes the record travel.

## Build

`GET /record/{run_id}` on the axum server renders a standalone HTML decision
record assembled **only from database rows** — no SPA, no JavaScript, printable,
survives even if the frontend is gone. That is the strongest honest form of the
claim: the document is served from platform records, not from application
state.

Sections, each labeled with *when it was recorded*:

1. Masthead — run, model, v{base}→v{new}, approved by / at, generated-at line.
2. Status — the one live-derived fact (in force / replaced by run N's vM),
   explicitly labeled as checked at generation time.
3. The decision — the `approved_package` frozen in the approval transaction.
   Honest fallback when an approval predates snapshots.
4. What the reviewer was told — review narrative, written at review open.
5. Guardrails — the bounded-delegation table.
6. Experiment ledger — every experiment and why it lived or died.
7. Agent action record — the full contemporaneous ledger, timestamps included,
   human approve action last.
8. Provenance — which section was recorded when.

Not included: charts (they are recomputed at render time in the SPA — putting
them in the record would be read-time reconstruction, the thing FR-3 forbids)
and the SPA's hardcoded material-diff panel (the recorded before→after lives in
the action ledger already).

## Wiring

- `crates/server/src/record.rs`: pure `render_record(&RecordData) -> String`
  (unit-testable: escaping, fate wording, fallback wording) + axum handler.
  Timestamps formatted by Postgres `to_char` — no new date dependency.
- Reuse `fetch_review_by_run` (made `pub(crate)`); dedicated small queries for
  run metadata and formatted actions.
- Pool reaches the handler via `Extension(pool)`; GraphQL state untouched.
- Frontend: "Decision record" link on approved reviews (approval gate + frozen
  as-approved panel), `/record` added to the Vite dev proxy.
- E2e: extends `version-identity.spec.ts` — after the supersession assertions,
  fetch `/record/{firstRun}`, assert fate + frozen wording + approve action,
  screenshot the document at 1920px.

## Also in this change

Lift-chart pin honesty (PR #6 review nit): `weakActionLabel` said "Pin weakest
slice" for lift charts while the pin actually selects the decile with the
largest actual-vs-predicted gap. Lift now gets "Pin largest gap".
