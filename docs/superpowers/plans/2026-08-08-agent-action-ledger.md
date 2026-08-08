# Agent Action Ledger (FR-1) Implementation Plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the demo an action-level agent record — every agent action attributable, previewable (before/after), refusals visible, reversibility explicit, the record surviving into the human review — answering FR-1's question "What did the agent change, why, and who approved it?"

**Architecture:** The platform simulation (`crates/platform/src/executor.rs::execute`) already streams `RunEvent`s to the server, which persists them per run. We add a new `RunEvent::Action` variant emitted at the real steps of the run (reads, spec changes, fits, refusals, reverts, review handoff), persist them contemporaneously into a new `agent_actions` table (FR-3: documentation as byproduct, never a read-time reconstruction), expose them on the GraphQL `Run`, and render them in a console "Agent record" panel plus a review-view "Agent action record" section. Human approval appends the run's single irreversible action, attributed `human`.

**Honesty rules:** Actions derive only from steps the simulation actually performs. The one human action is written only when a human actually approves. Old runs predate the table and show an honest empty state. This is a design exploration of FR-1, not a claim about Prediction Lab's product.

**Tech Stack:** Rust (axum, async-graphql, sqlx/Postgres), React + TypeScript (Vite), Playwright e2e.

**Scope guard (from skill):** model-candidate gate only. No deployment, filing, fairness, or rollout controls.

---

## File structure

| File | Responsibility |
|---|---|
| Create `crates/server/migrations/0002_agent_actions.sql` | `agent_actions` table |
| Modify `crates/platform/src/executor.rs` | `AgentAction`/`ActionKind` types, `RunEvent::Action`, `spec_change`, `actions_after_landing` + unit tests, emit sites |
| Modify `crates/server/src/runsvc.rs` | persist `Action` events with a per-run seq counter; append human `approve` action in `approve_review` |
| Modify `crates/server/src/schema.rs` | GraphQL `AgentAction`, `Run.actions`, fetch query |
| Modify `frontend/src/api.ts` | `AgentAction` type, `actions` in `RUN_FIELDS` |
| Create `frontend/src/AgentActionLog.tsx` | console action-record panel |
| Modify `frontend/src/App.tsx` | mount panel in console view; refresh run after approve |
| Modify `frontend/src/ReviewView.tsx` | "Agent action record" section + metrics chip |
| Modify `frontend/src/workspace.css` | panel + row styling |
| Create `frontend/e2e/agent-record.spec.ts` | e2e coverage |

---

### Task 1: Platform action types + pure helpers (TDD)

**Files:** Modify `crates/platform/src/executor.rs`

- [ ] **Step 1: Write failing tests** at the bottom of `executor.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use plab_core::protocol::{Disposition, GuardrailOutcome, Verdict};

    fn record_with(rails: Option<GuardrailOutcome>, disposition: Disposition) -> ExperimentRecord {
        let plan = plab_agent::Playbook::base_plans()
            .into_iter()
            .find(|p| p.code == "EXP-03")
            .unwrap();
        ExperimentRecord {
            plan,
            fit: None,
            rails,
            verdict: Verdict {
                disposition,
                expert_text: String::new(),
                gloss_text: String::new(),
                lineage: None,
            },
            disposition,
            evidence: None,
        }
    }

    fn failing_territory_rails() -> GuardrailOutcome {
        GuardrailOutcome {
            budget_used: 0,
            budget_limit: 2,
            budget_ok: true,
            territory_movement_pct: 4.1,
            territory_worst_zone: "Z4".into(),
            territory_direct: true,
            territory_limit_pct: 3.0,
            territory_ok: false,
            folds_required: 4,
            folds_held: 5,
            folds_ok: true,
        }
    }

    #[test]
    fn scrapped_rail_failure_yields_refuse_then_revert() {
        let r = record_with(Some(failing_territory_rails()), Disposition::Scrapped);
        let acts = actions_after_landing(&r);
        assert_eq!(acts.len(), 2);
        assert_eq!(acts[0].kind, ActionKind::Refuse);
        assert!(acts[0].refusal_reason.as_deref().unwrap().contains("territory"));
        assert_eq!(acts[1].kind, ActionKind::Revert);
        assert!(acts.iter().all(|a| a.reversible));
    }

    #[test]
    fn clean_candidate_yields_no_actions() {
        let mut rails = failing_territory_rails();
        rails.territory_ok = true;
        let r = record_with(Some(rails), Disposition::Candidate);
        assert!(actions_after_landing(&r).is_empty());
    }

    #[test]
    fn spec_change_covers_every_archetype() {
        for p in plab_agent::Playbook::base_plans() {
            let (target, before, after) = spec_change(p.archetype);
            assert!(!target.is_empty() && !before.is_empty() && !after.is_empty());
        }
    }
}
```

(Adjust the `plab_agent` import path to how `executor.rs` already refers to the agent crate — it uses `agent::` today; and check `Verdict`/`GuardrailOutcome` construction against `crates/core/src/protocol.rs`. Field lists above match protocol.rs as of `50047cd`.)

- [ ] **Step 2: Run to verify failure**: `cargo test -p plab-platform` → FAIL (types/functions missing).

- [ ] **Step 3: Implement types + helpers** in `executor.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionKind { Read, Change, Fit, Refuse, Revert, Handoff }

impl ActionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            ActionKind::Read => "read",
            ActionKind::Change => "change",
            ActionKind::Fit => "fit",
            ActionKind::Refuse => "refuse",
            ActionKind::Revert => "revert",
            ActionKind::Handoff => "handoff",
        }
    }
}

/// One attributable step of the modeling agent's work, streamed to the
/// console as it happens so the record is a byproduct of the run, never a
/// later reconstruction.
#[derive(Debug, Clone)]
pub struct AgentAction {
    pub kind: ActionKind,
    pub target: String,
    pub detail: String,
    pub before: Option<String>,
    pub after: Option<String>,
    pub reversible: bool,
    pub refusal_reason: Option<String>,
    pub experiment_code: Option<String>,
}

pub fn spec_change(archetype: Archetype) -> (&'static str, &'static str, &'static str) {
    match archetype {
        Archetype::SplineAge => ("Driver age term", "5 coarse bands", "natural cubic spline"),
        Archetype::InteractionAgeVehicle => ("Driver age × vehicle age", "absent", "interaction term"),
        Archetype::CredibilityTerritory => ("Territory relativities", "2023 filed table", "credibility blend toward recent experience"),
        Archetype::CappedAccidents => ("Prior accidents", "absent", "count capped at 3"),
        Archetype::NegBinomialFamily => ("Error family", "Poisson", "negative binomial"),
        Archetype::MileageBands => ("Annual mileage", "absent", "banded factor with imputation"),
        Archetype::ComboSplineAccidents => ("Age spline + capped accidents", "two separate candidates", "one combined specification"),
    }
}

/// Refusals and reverts a landed experiment leaves in the action record.
pub fn actions_after_landing(record: &ExperimentRecord) -> Vec<AgentAction> {
    let code = record.plan.code.to_string();
    let mut out = Vec::new();
    if let Some(rails) = &record.rails {
        let mut reasons = Vec::new();
        if !rails.budget_ok {
            reasons.push(format!("factor budget {} of {} exceeded", rails.budget_used, rails.budget_limit));
        }
        if !rails.territory_ok {
            reasons.push(format!(
                "territory movement {:.1}% in {} beyond the filed {:.0}% tolerance",
                rails.territory_movement_pct, rails.territory_worst_zone, rails.territory_limit_pct
            ));
        }
        if !rails.folds_ok {
            reasons.push(format!("lift held in only {} of {} folds", rails.folds_held, rails.folds_required));
        }
        if !reasons.is_empty() {
            out.push(AgentAction {
                kind: ActionKind::Refuse,
                target: format!("{code} promotion"),
                detail: "A guardrail stops promotion. The agent cannot carry this change forward.".into(),
                before: None,
                after: None,
                reversible: true,
                refusal_reason: Some(reasons.join("; ")),
                experiment_code: Some(code.clone()),
            });
        }
    }
    if record.disposition == Disposition::Scrapped {
        out.push(AgentAction {
            kind: ActionKind::Revert,
            target: format!("{code} specification"),
            detail: "Change not carried. The run branch keeps v12 plus surviving candidates only.".into(),
            before: None,
            after: None,
            reversible: true,
            refusal_reason: None,
            experiment_code: Some(code),
        });
    }
    out
}
```

Add `Action { action: AgentAction }` to `pub enum RunEvent`.

- [ ] **Step 4: Run tests**: `cargo test -p plab-platform` → PASS (all, including preexisting).

- [ ] **Step 5: Commit** `feat: agent action types and landing-derived refusal/revert actions`.

### Task 2: Emit actions at the real steps

**Files:** Modify `crates/platform/src/executor.rs`

- [ ] **Step 1: Emit in `execute()`** (each right after the step it describes):
  - After `profile()`: `Read` — target "Policy dataset", detail with `fmt_thousands(rows.len())` rows and the claim frequency target; `reversible: true`.
  - After `filed_relativities`: `Read` — target "v12 filed territory relativities", detail noting the table is frozen for the run.
  - After the baseline fit: `Fit` — target "Baseline v12 on train", detail with train rows + baseline Gini.
  - After the fold-cache loop: `Fit` — target "5-fold baseline cross-validation".
  - In the winner block (after `records[wi].disposition = Disposition::Winner;`): `Change` — target "Run winner", before "no winner", after winner code, `experiment_code` = winner code.
  - After `review = Some(...)`: `Handoff` — target "Human review", detail "The agent requested review. It cannot approve; approval is the human's only-irreversible action."
- [ ] **Step 2: Emit in `run_one()`**:
  - In the `refuses_to_fit` branch, before `Landed`: `Refuse` — target `{code} fit`, `refusal_reason` from `record.verdict.expert_text`, `experiment_code` set.
  - After the `refuses_to_fit` gate (normal path), before the full-train fit: `Change` — from `spec_change(plan.archetype)`: target, `before`/`after` populated, `experiment_code` set.
  - After the fit summary for the experiment exists: `Fit` — target `{code} GLM fit and fold CV`, detail with train Gini delta.
  - After the record is built, before/alongside `Landed`: `for a in actions_after_landing(&record) { sink(RunEvent::Action { action: a }); }`
- [ ] **Step 3: Compile + full platform tests**: `cargo test -p plab-platform` → PASS.
- [ ] **Step 4: Commit** `feat: stream agent actions from the run executor`.

### Task 3: Persist + expose over GraphQL

**Files:** Create `crates/server/migrations/0002_agent_actions.sql`; modify `crates/server/src/runsvc.rs`, `crates/server/src/schema.rs`

- [ ] **Step 1: Migration**:

```sql
CREATE TABLE agent_actions (
  id              bigserial PRIMARY KEY,
  run_id          bigint NOT NULL REFERENCES runs(id),
  seq             int NOT NULL,
  actor           text NOT NULL,
  kind            text NOT NULL,
  target          text NOT NULL,
  detail          text NOT NULL,
  before_state    text,
  after_state     text,
  reversible      boolean NOT NULL,
  refusal_reason  text,
  experiment_code text,
  at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, seq)
);
```

- [ ] **Step 2: Persist in `runsvc.rs`**: thread `let mut seq: i32 = 0;` through `drive_run`'s event loop; extend `persist_event(pool, run_id, ev, &mut seq)` with:

```rust
RunEvent::Action { action } => {
    *seq += 1;
    sqlx::query(
        "INSERT INTO agent_actions (run_id, seq, actor, kind, target, detail, before_state, after_state, reversible, refusal_reason, experiment_code) VALUES ($1, $2, 'agent', $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(run_id)
    .bind(*seq)
    .bind(action.kind.as_str())
    .bind(&action.target)
    .bind(&action.detail)
    .bind(&action.before)
    .bind(&action.after)
    .bind(action.reversible)
    .bind(&action.refusal_reason)
    .bind(&action.experiment_code)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
}
```

- [ ] **Step 3: Human approve action** in `approve_review` (after the approval succeeds), single statement so seq stays consistent:

```rust
sqlx::query(
    "INSERT INTO agent_actions (run_id, seq, actor, kind, target, detail, reversible) SELECT $1, COALESCE(MAX(seq), 0) + 1, 'human', 'approve', $2, $3, false FROM agent_actions WHERE run_id = $1",
)
.bind(run_id)
.bind(format!("Model version v{next_version}"))
.bind(format!("Approved {winner_code} and created v{next_version}. The run's only irreversible action, and only a human can take it."))
```

(Adapt variable names to what `approve_review` already has in scope.)

- [ ] **Step 4: GraphQL** in `schema.rs`:

```rust
#[derive(SimpleObject, Clone)]
pub struct AgentAction {
    pub seq: i32,
    pub actor: String,
    pub kind: String,
    pub target: String,
    pub detail: String,
    pub before_state: Option<String>,
    pub after_state: Option<String>,
    pub reversible: bool,
    pub refusal_reason: Option<String>,
    pub experiment_code: Option<String>,
    pub at_ms: f64,
}
```

Add `pub actions: Vec<AgentAction>` to `Run`; in `fetch_run`, load with:

```sql
SELECT seq, actor, kind, target, detail, before_state, after_state, reversible, refusal_reason, experiment_code, extract(epoch FROM at) * 1000
FROM agent_actions WHERE run_id = $1 ORDER BY seq
```

- [ ] **Step 5: Compile + server tests**: `cargo test -p plab-server --bin server` → PASS (5 preexisting context tests must stay green).
- [ ] **Step 6: Commit** `feat: persist agent actions and expose them on the run`.

### Task 4: Console panel

**Files:** Modify `frontend/src/api.ts`, `frontend/src/App.tsx`, `frontend/src/workspace.css`; create `frontend/src/AgentActionLog.tsx`

- [ ] **Step 1: api.ts** — add the type and extend `RUN_FIELDS`:

```ts
export interface AgentAction {
  seq: number;
  actor: 'agent' | 'human';
  kind: 'read' | 'change' | 'fit' | 'refuse' | 'revert' | 'handoff' | 'approve';
  target: string;
  detail: string;
  beforeState: string | null;
  afterState: string | null;
  reversible: boolean;
  refusalReason: string | null;
  experimentCode: string | null;
  atMs: number;
}
```

Add `actions: AgentAction[]` to `Run` and `actions { seq actor kind target detail beforeState afterState reversible refusalReason experimentCode atMs }` to `RUN_FIELDS`.

- [ ] **Step 2: `AgentActionLog.tsx`** — props `{ actions, onSelectExperiment }`. Header eyebrow "Bounded delegation", title "Agent record", count line `N actions · M refused · K reverted`. Each row: seq, actor chip (AI/Human), kind label, target, detail; `before → after` line when both present; refusal reason highlighted (`role="note"`, warn styling); status word: refuse → "Refused", revert → "Reverted", approve → "Irreversible · human"; otherwise "Applied · reversible". Rows with `experimentCode` clickable → `onSelectExperiment(code)`. Empty state: "No action record. This run predates action capture; replay to record one." Rendered inside a `<details open>` so it collapses.
- [ ] **Step 3: Mount in App console view** — full-width section under the `run-workspace` grid, before `</main>`; pass `run?.actions ?? []` and `chooseExperiment`. After `approveReview` succeeds in the approve handler, re-fetch the run so the human `approve` action appears.
- [ ] **Step 4: CSS** in `workspace.css` — `.agent-record` section, row grid, `.act-refuse` warn accent, `.act-human` accent chip. Follow existing panel/card conventions (workspace-heading, section-count).
- [ ] **Step 5: Verify**: `npm run typecheck && npm run build` (or the repo's script names from `frontend/package.json`) → PASS.
- [ ] **Step 6: Commit** `feat: agent record panel in the run console`.

### Task 5: Review-view record section

**Files:** Modify `frontend/src/ReviewView.tsx`

- [ ] **Step 1:** Add metrics chip to `review-metrics`: `<div><span>Agent actions</span><strong>{run.actions.length} · {refusedCount} refused</strong></div>`.
- [ ] **Step 2:** Add an "Agent action record" section between the guardrail matrix and the approval gate, reusing `AgentActionLog` (no experiment click-through needed in review: pass a no-op or hide links). One-line note under it: "The record above is the run's own trail, kept so this decision stays reconstructable at sign-off." No new approval mechanics — the gate is unchanged.
- [ ] **Step 3:** `npm run typecheck && npm run build` → PASS.
- [ ] **Step 4: Commit** `feat: agent action record carried into the review package`.

### Task 6: e2e + full verification

**Files:** Create `frontend/e2e/agent-record.spec.ts`

- [ ] **Step 1:** Follow the structure of the existing `frontend/e2e/*.spec.ts` (same fixtures/baseURL). Cover: (a) after a run completes, the Agent record panel lists actions including at least one Refused row with a visible reason; (b) opening the review shows the record section and the actions metric; (c) approving appends a `human`-attributed irreversible row. If the suite mocks or replays runs, mirror that pattern rather than starting a real run.
- [ ] **Step 2:** Run the repo's e2e command from `.claude/reference/commands.md`. If the environment cannot run Playwright (no local DB/app), record that limit honestly and rely on Rust tests + typecheck + build + post-deploy live checks.
- [ ] **Step 3:** `cargo test --workspace` → all green.
- [ ] **Step 4: Commit** `test: agent record e2e coverage`.

### Task 7: Ship

- [ ] Auto-Merge cycle: push branch, PR onto `main`, squash-merge (mode already authorized this session).
- [ ] Deploy: `railway up --service web --detach` from a fresh worktree at the squash commit (no GitHub auto-deploy exists).
- [ ] Live smoke: new run → GraphQL `latestRun { actions { kind actor } }` non-empty with a `refuse`; UI shows the panel; approve appends the human row. Note for the reviewer: old runs show the empty state until Replay.

---

## Self-review notes

- FR-1 facets → coverage: loggable/attributable (table + actor), previewable (before/after on changes), approvable (existing human gate + recorded approve action), refusable (refuse rows from real guardrail + data-quality stops), reversible (status wording + revert rows + "only irreversible action" framing), examiner-explainable (record carried into review). Deniable-datasets facet is out of demo scope — nothing in the sim models dataset ACLs; do not fake one.
- Approve action must not be written on failed approval — insert only after the existing approval update succeeds.
- `seq` uniqueness: single writer per run (drive_run loop) + `UNIQUE (run_id, seq)`; approve uses MAX+1 in one statement.
- Old deployed runs: `actions` empty → honest empty state (no backfill, no fabrication).
