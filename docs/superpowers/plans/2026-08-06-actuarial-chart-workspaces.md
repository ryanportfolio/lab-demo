# Actuarial Chart Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `prediction-lab-actuarial-ux` and `designing-actuarial-chart-workspaces`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every actuarial evidence chart a linked, question-answering workspace with semantically valid interaction, exact evidence, bounded AI follow-up, and preserved review state.

**Architecture:** A chart-semantics module declares the decision question and valid capabilities for each chart kind. The generic SVG renderer owns pointer/keyboard selection and comparison rendering; EvidencePanel owns linked exact evidence and provenance; App owns URL, agent, and saved-review continuity.

**Tech Stack:** React 19, TypeScript, SVG, GraphQL typed fetch, Playwright, Rust evidence generation.

---

### Task 1: Encode chart semantics

**Files:**
- Create: `frontend/src/chartWorkspace.ts`
- Test: `frontend/e2e/chart-workspace.spec.ts`

- [x] Define `ChartContract`, `ChartSelection`, `ChartMode`, and `SavedChartEvidence`.
- [x] Map every chart kind to a question, selection mode, comparable series, weight series, weak-point rule, guardrail, and supported actions.
- [x] Add browser assertions proving unsupported capabilities do not render.

### Task 2: Implement pin and range interaction

**Files:**
- Modify: `frontend/src/Chart.tsx`
- Modify: `frontend/src/workspace.css`
- Test: `frontend/e2e/chart-workspace.spec.ts`

- [x] Replace chart-body click-to-expand with nearest-mark pinning; retain the explicit full-screen control.
- [x] Add pointer drag and Shift+Arrow range extension only for range-capable charts.
- [x] Draw pinned marks/ranges with color-independent selection treatment.
- [x] Announce selection; make Escape and visible Clear reset it.

### Task 3: Add valid comparison modes and guardrails

**Files:**
- Modify: `frontend/src/Chart.tsx`
- Modify: `frontend/src/chartWorkspace.ts`
- Modify: `frontend/src/workspace.css`
- Test: `frontend/e2e/chart-workspace.spec.ts`

- [x] Add compact `Level | Change` control only when comparable series exist.
- [x] Calculate absolute or ratio-percent deltas according to the chart contract.
- [x] Render territory ±5% and fold zero guardrails with labels and breach direction.
- [x] Keep exposure on its own visual scale and out of rate comparisons.

### Task 4: Build linked evidence strip and exact table

**Files:**
- Modify: `frontend/src/EvidencePanel.tsx`
- Modify: `frontend/src/Chart.tsx`
- Modify: `frontend/src/workspace.css`
- Test: `frontend/e2e/chart-workspace.spec.ts`

- [x] Show selected point/range, exact values, delta, exposure share, weak point, and source in one compact strip.
- [x] Highlight matching rows in the exact-values table while keeping its disclosure closed until explicitly opened, avoiding layout growth on pin.
- [x] Keep the chart's decision question and weakest available evidence visible outside hover.
- [x] Preserve fixed evidence geometry while tabs or experiments refresh.

### Task 5: Carry selection into AI and URL state

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/AskPanel.tsx`
- Modify: `frontend/src/EvidencePanel.tsx`
- Modify: `frontend/src/chartWorkspace.ts`
- Test: `frontend/e2e/chart-workspace.spec.ts`

- [x] Restore `exp`, `chart`, `mode`, and `sel` from the URL, rejecting impossible state.
- [x] Update those parameters without page reload when linked selection changes.
- [x] Prefill Ask AI with a bounded question carrying experiment, chart, selection, comparison, target, denominator, run, and source.
- [x] Verify the agent remains explanatory and cannot approve.

### Task 6: Preserve evidence into review

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/ReviewView.tsx`
- Modify: `frontend/src/chartWorkspace.ts`
- Modify: `frontend/src/workspace.css`
- Test: `frontend/e2e/chart-workspace.spec.ts`

- [x] Save a local prototype snapshot containing question, selection, values, comparison, source, and weak point.
- [x] Copy a stateful evidence link with accessible success/failure feedback.
- [x] Display saved evidence in the decision package and label it local to this prototype.
- [x] Preserve human-only review authority.

### Task 7: Correct invalid multi-unit evidence

**Files:**
- Modify: `crates/platform/src/evidence.rs`
- Modify: `crates/platform/src/executor.rs`
- Modify: `crates/platform/src/evidence.rs` tests
- Test: `frontend/e2e/evidence.spec.ts`

- [x] Split mileage missing-share and missing-status frequency into separate charts so percentages and claims per car year never share one axis.
- [x] Retain both views in EXP-06 evidence and keep the data-quality stop prominent.
- [x] Run Rust evidence and platform tests.

### Task 8: Verify and refine

**Files:**
- Modify as defects require: `frontend/src/*.tsx`, `frontend/src/workspace.css`, `frontend/e2e/*.spec.ts`
- Artifacts: `frontend/.tmp/chart-system/`

- [x] Run typecheck, production build, Rust tests, and all browser tests.
- [x] Capture 1920×1080 and 390×844 default, pinned, range, territory-guardrail, missingness, and review states.
- [x] Critique pixels and computed geometry; fix until a full pass yields no must-fix defects.
- [x] Audit every design requirement and chart kind against direct runtime evidence.

Git commit, push, PR, merge, and deployment are intentionally excluded because the user has not authorized them.
