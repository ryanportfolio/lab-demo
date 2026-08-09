# Version Identity + Supersession-Aware Review (FR-2/FR-5) Implementation Plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reviews and evidence carry version identity; a superseded or retired approval says so and still renders exactly what the reviewer approved (decision-time snapshot); the demo's story metric becomes "question → trusted, reviewable, reconstructable decision".

**Architecture:** Approving a review freezes an `approved_package` JSON into the reviews row (decision-time snapshot — the "generated view is itself an artifact" constraint). The review query derives a result status (active / superseded / retired) from the model_versions table, which `approve_review` already mutates on replay. The frontend renders a status chip, an "as approved" panel for non-active reviews, version-stamped evidence context, and supersession-marked saved-evidence cards. A `?run=` URL param makes old runs (and thus superseded reviews) reachable.

**Tech Stack:** Rust (axum, async-graphql, sqlx/Postgres), React + TypeScript, Playwright.

**Honesty rules:** Approvals recorded before snapshots show an explicit "recorded before snapshots" state — no backfill. Status derives only from real table state. Migration takes the next unused version: directory currently holds 0001, 0002, 0003 → new file is **0004** (pitfalls.md 2026-08-08).

---

## File structure

| File | Responsibility |
|---|---|
| Create `crates/server/migrations/0004_review_snapshot.sql` | `approved_package` column |
| Modify `crates/server/src/runsvc.rs` | build + store snapshot in `approve_review`; pure helpers + tests |
| Modify `crates/server/src/schema.rs` | `ApprovedPackage` type, `Review.{resultStatus,approvedAtMs,package}`, extended fetch |
| Modify `frontend/src/api.ts` | new Review fields, `fetchRun(id)` |
| Modify `frontend/src/App.tsx` | `?run=` bootstrap; pass `baseModelVersion` into evidence context |
| Modify `frontend/src/ReviewView.tsx` | status chip, as-approved panel, superseded saved-cards group, decision-time metric |
| Modify `frontend/src/EvidencePanel.tsx` | dynamic version in ask/save context |
| Modify `frontend/src/chartWorkspace.ts` | `baseVersion` on `SavedChartEvidence` |
| Modify `frontend/src/workspace.css` | chip + as-approved styles (desktop-checked) |
| Create `frontend/e2e/version-identity.spec.ts` | supersession e2e |
| Modify `README.md`, `.claude/reference/commands.md` | story metric paragraph; correct the deploy section |

### Task 1: Server — snapshot + status (TDD)

**Files:** Create `crates/server/migrations/0004_review_snapshot.sql`; modify `crates/server/src/runsvc.rs`, `crates/server/src/schema.rs`

- [ ] **Step 1: Migration** (verify `ls crates/server/migrations/` still shows 0001–0003 first):

```sql
ALTER TABLE reviews ADD COLUMN approved_package jsonb;
```

- [ ] **Step 2: Failing tests** — `runsvc.rs` has no test module; add at the bottom:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn approved_package_freezes_the_decision_view() {
        let p = approved_package("EXP-07", 12, 13, 0.0132, 0.0110, 3, 26, 4, "9.8% of exposure");
        assert_eq!(p["winner_code"], "EXP-07");
        assert_eq!(p["base_version"], 12);
        assert_eq!(p["new_version"], 13);
        assert_eq!(p["guardrails_held"], 3);
        assert_eq!(p["actions_total"], 26);
        assert_eq!(p["actions_refused"], 4);
        assert_eq!(p["weakest_point"], "9.8% of exposure");
    }

    #[test]
    fn result_status_reflects_version_table_state() {
        assert_eq!(result_status("open", &None), None);
        assert_eq!(result_status("approved", &None), Some("retired"));
        assert_eq!(result_status("approved", &Some("active".into())), Some("active"));
        assert_eq!(result_status("approved", &Some("superseded".into())), Some("superseded"));
    }
}
```

- [ ] **Step 3: Run** `cargo test -p plab-server --bin server` → FAIL (functions missing).
- [ ] **Step 4: Implement in `runsvc.rs`:**

```rust
/// The decision-time snapshot: what the reviewer approved, frozen so a
/// superseded review still renders exactly the package that was signed.
#[allow(clippy::too_many_arguments)]
pub fn approved_package(
    winner_code: &str,
    base_version: i32,
    new_version: i32,
    train_delta: f64,
    holdout_delta: f64,
    guardrails_held: i64,
    actions_total: i64,
    actions_refused: i64,
    weakest_point: &str,
) -> serde_json::Value {
    json!({
        "winner_code": winner_code,
        "base_version": base_version,
        "new_version": new_version,
        "train_delta": train_delta,
        "holdout_delta": holdout_delta,
        "guardrails_held": guardrails_held,
        "actions_total": actions_total,
        "actions_refused": actions_refused,
        "weakest_point": weakest_point,
    })
}

/// active | superseded | retired (approved but its version row was replaced
/// by a replay's merge), None while the review is still open.
pub fn result_status(review_status: &str, version_status: &Option<String>) -> Option<&'static str> {
    if review_status != "approved" {
        return None;
    }
    match version_status.as_deref() {
        Some("active") => Some("active"),
        Some(_) => Some("superseded"),
        None => Some("retired"),
    }
}
```

- [ ] **Step 5: Store the snapshot in `approve_review`** — inside the existing transaction, after the reviews UPDATE and the agent_actions INSERT. Counts come from the same tx; weakest point from the review summary paragraphs (the exposure sentence, same regex family the frontend uses):

```rust
    let (guardrails_held,): (i64,) = sqlx::query_as(
        "SELECT jsonb_array_length(guardrail_rows) FROM reviews WHERE id = $1",
    )
    .bind(review_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    let (actions_total, actions_refused): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COUNT(*) FILTER (WHERE kind = 'refuse') FROM agent_actions WHERE run_id = $1",
    )
    .bind(run_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;
    let (summary,): (serde_json::Value,) =
        sqlx::query_as("SELECT summary FROM reviews WHERE id = $1")
            .bind(review_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    let weakest = summary["paragraphs"]
        .as_array()
        .and_then(|a| {
            a.iter()
                .filter_map(|v| v.as_str())
                .find(|p| p.to_lowercase().contains("exposure"))
        })
        .unwrap_or("");
    sqlx::query("UPDATE reviews SET approved_package = $1 WHERE id = $2")
        .bind(approved_package(
            &winner_code,
            base_version,
            new_version,
            train_delta,
            holdout_delta,
            guardrails_held,
            actions_total,
            actions_refused,
            weakest,
        ))
        .bind(review_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;
```

(Names `winner_code`, `base_version`, `new_version`, `train_delta`, `holdout_delta`, `run_id` are already in scope in `approve_review`; check the summary paragraph shape against `agent::review_summary` if the weakest string comes out empty.)

- [ ] **Step 6: GraphQL** — in `schema.rs` add:

```rust
#[derive(SimpleObject, Clone)]
pub struct ApprovedPackage {
    pub winner_code: String,
    pub base_version: i32,
    pub new_version: i32,
    pub train_delta: f64,
    pub holdout_delta: f64,
    pub guardrails_held: i32,
    pub actions_total: i32,
    pub actions_refused: i32,
    pub weakest_point: String,
}
```

`Review` gains `pub result_status: Option<String>`, `pub approved_at_ms: Option<f64>`, `pub package: Option<ApprovedPackage>`. Extend `fetch_review_by_run`'s SELECT with `approved_package, (EXTRACT(EPOCH FROM approved_at) * 1000)::float8` and the result_version lookup with `SELECT version, status FROM model_versions WHERE id = $1`; feed `runsvc::result_status(&r.status, &version_status)`. Map the JSON into `ApprovedPackage` field-by-field (`as_i64`/`as_f64`/`as_str` with defaults); `package: None` when the column is NULL.

- [ ] **Step 7:** `cargo test -p plab-server --bin server` → PASS (7 = 5 old + 2 new). Commit `feat: freeze the approved review package and expose version status`.

### Task 2: Frontend — status chip + as-approved panel

**Files:** Modify `frontend/src/api.ts`, `frontend/src/ReviewView.tsx`, `frontend/src/workspace.css`

- [ ] **Step 1: api.ts** — `Review` gains:

```ts
  resultStatus: 'active' | 'superseded' | 'retired' | null;
  approvedAtMs: number | null;
  package: {
    winnerCode: string; baseVersion: number; newVersion: number;
    trainDelta: number; holdoutDelta: number; guardrailsHeld: number;
    actionsTotal: number; actionsRefused: number; weakestPoint: string;
  } | null;
```

and `REVIEW_FIELDS` adds `resultStatus approvedAtMs package { winnerCode baseVersion newVersion trainDelta holdoutDelta guardrailsHeld actionsTotal actionsRefused weakestPoint }`.

- [ ] **Step 2: ReviewView** — beside the Approved chip render the version fate:

```tsx
{approved && review.resultStatus && review.resultStatus !== 'active' && (
  <b className="status superseded">
    {review.resultStatus === 'retired' ? 'Retired by a later replay' : 'Superseded'}
  </b>
)}
```

and directly under the review header, for non-active approvals, the frozen record:

```tsx
{approved && review.resultStatus && review.resultStatus !== 'active' && (
  <section className="as-approved" aria-label="Decision as approved">
    <span className="eyebrow">As approved · frozen at sign-off</span>
    {review.package ? (
      <p>
        {review.package.winnerCode} created v{review.package.newVersion} from v
        {review.package.baseVersion} ({fmtDelta(review.package.trainDelta)} train,{' '}
        {fmtDelta(review.package.holdoutDelta)} holdout) with{' '}
        {review.package.guardrailsHeld} guardrails held and{' '}
        {review.package.actionsTotal} agent actions ({review.package.actionsRefused}{' '}
        refused). Weakest point at sign-off: {review.package.weakestPoint}
        {review.approvedAtMs
          ? ` · approved ${new Date(review.approvedAtMs).toLocaleDateString()}`
          : ''}
      </p>
    ) : (
      <p>This approval was recorded before decision-time snapshots existed; only the live tables above remain.</p>
    )}
  </section>
)}
```

- [ ] **Step 3: Decision-time metric (recommendation C's mechanism)** — in `review-metrics`, after the Agent actions cell:

```tsx
<div><span>Question → decision</span><strong>{run.elapsedMs != null ? `${(run.elapsedMs / 1000).toFixed(1)}s run` : '—'}</strong></div>
```

- [ ] **Step 4: CSS** (desktop measure rules apply — nothing full-bleed):

```css
.review-version .status.superseded { background: color-mix(in srgb, var(--warn) 14%, transparent); color: var(--warn) }
.as-approved { border: 1px solid var(--border); border-left: 3px solid var(--warn); border-radius: var(--r-sm); margin: 14px 0 0; max-width: 880px; padding: 12px 14px }
.as-approved p { color: var(--fg-muted); font-size: 14.5px; margin: 6px 0 0 }
```

- [ ] **Step 5:** `npm run typecheck && npm run build` → PASS. Commit `feat: superseded reviews keep their decision-time record`.

### Task 3: `?run=` navigation

**Files:** Modify `frontend/src/api.ts`, `frontend/src/App.tsx`

- [ ] **Step 1: api.ts:**

```ts
export async function fetchRun(id: string): Promise<Run | null> {
  const d = await gql<{ run: Run | null }>(
    `query($id: ID!) { run(id: $id) { ${RUN_FIELDS} } }`,
    { id },
  );
  return d.run;
}
```

- [ ] **Step 2: App bootstrap** — in the initial-load effect, before falling back to `fetchLatestRun()`:

```ts
const requested = new URLSearchParams(location.search).get('run');
const latest = requested ? await fetchRun(requested) : await fetchLatestRun();
```

(keep the existing `startRun` fallback only for the no-`run`-param path; an unknown `?run=` shows the existing "API unreachable"-free empty state with the error banner from the catch). The 400ms poll effect must also use `fetchRun(requested)` when the param is present so a running historical run still updates — simplest: store `requestedRun` in a ref and reuse in both effects.

- [ ] **Step 3:** typecheck + build → PASS. Commit `feat: reach any run by url for superseded-review inspection`.

### Task 4: Version stamps on evidence + saved cards

**Files:** Modify `frontend/src/EvidencePanel.tsx`, `frontend/src/chartWorkspace.ts`, `frontend/src/App.tsx`, `frontend/src/ReviewView.tsx`

- [ ] **Step 1:** `EvidencePanel` gains a `baseVersion: number` prop; the hardcoded `model: 'v12 candidate comparison'` in its ask/save context becomes `` model: `v${baseVersion} candidate comparison` ``. Both call sites pass `run.baseModelVersion` (App console) / `run.baseModelVersion` (ReviewView).
- [ ] **Step 2:** `SavedChartEvidence` gains `baseVersion: number`; the builder function at `chartWorkspace.ts:398` threads it through from the context; existing stored cards without the field render `v?` — acceptable, honest.
- [ ] **Step 3:** ReviewView saved-evidence section: stop hiding other runs' cards. Current-run cards render as today; other-run cards render after them with a `superseded` tag:

```tsx
const otherSaved = savedEvidence.filter((item) => item.runId !== run.id);
```

```tsx
{otherSaved.map((item) => (
  <a className="saved-evidence-row superseded-card" href={item.url} key={item.id}>
    <span><b>{item.code}</b>{item.title}</span>
    <strong>run {item.runId} · v{item.baseVersion ?? '?'} base</strong>
    <small>Superseded · saved from an earlier run</small>
  </a>
))}
```

```css
.saved-evidence-row.superseded-card { opacity: .62 }
.saved-evidence-row.superseded-card small { color: var(--warn) }
```

- [ ] **Step 4:** typecheck + build → PASS. Commit `feat: version identity on evidence context and saved cards`.

### Task 5: Story copy + commands.md correction

**Files:** Modify `README.md`, `.claude/reference/commands.md`

- [ ] **Step 1: README** — after the existing intro, one paragraph:

> The measure this prototype optimizes is not fits per second. It is the time from an actuarial question to a decision a skeptical reviewer can trust, sign, and reconstruct months later — the run ledger, evidence, agent record, and frozen approval package all serve that one metric. The AI's job is to make human judgment scalable, never to substitute for it: approval stays a human-only, irreversible act.

- [ ] **Step 2: commands.md** — replace the Deploy section:

```markdown
## Deploy

No GitHub auto-deploy. Deploys are manual via the Railway CLI from a clean
checkout of the target commit (`.tmp/` worktree):

- `railway link --project plab-experiments`
- `railway up --service web --detach`
- Verify the worktree is complete (`Dockerfile` present) before `railway up` —
  an incomplete upload builds an empty app (pitfalls.md 2026-08-08).
- Live URL: https://web-production-563b7.up.railway.app
```

- [ ] **Step 3:** Commit `docs: decision-metric story and corrected deploy reference`.

### Task 6: E2e + desktop screenshot

**Files:** Create `frontend/e2e/version-identity.spec.ts`

- [ ] **Step 1:** One serial test at 1920×1200 (follow `agent-record.spec.ts` helpers): (a) load latest run, approve its review if pending (replay first if it predates action capture); (b) note the run id, hit Replay, wait ready, approve the new review; (c) `goto('/?run=<old id>')`, open the decision package; expect the `Superseded`/`Retired` chip, the `.as-approved` panel text containing "frozen at sign-off", and the Question → decision metric cell; (d) bounding-box check: `.as-approved` width ≤ 900; screenshot `.tmp/shots/superseded-review.png` for visual inspection before merge.
- [ ] **Step 2:** `cargo test --workspace`, typecheck, build all green. Commit `test: supersession keeps the decision-time record`.

### Task 7: Ship

- [ ] Auto-merge cycle (PR onto main, squash). Deploy via the corrected commands.md procedure. Post-deploy: run the new spec against prod through the vite proxy; verify live GraphQL `review { resultStatus package { winnerCode } }`; inspect both screenshots at desktop width before reporting.

## Self-review notes

- FR-2 "which version is authoritative, what changed, who/when/why" → status chip + package + existing diff/actions. FR-5 export staleness → saved-card supersession. Talk-derived constraint → approved_package. C → metric cell + README. All four map to tasks.
- The `run(id)` GraphQL query already exists (schema.rs QueryRoot) — Task 3 only adds the client + bootstrap.
- Old approvals without snapshots: explicit "recorded before snapshots" copy, no fabrication.
- Migration numbered 0004 after directory check (collision pitfall).
