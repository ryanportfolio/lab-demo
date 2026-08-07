# Actuarial Workspace V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing experiment demo into an actuary-native workspace where visual evidence leads, context never disappears, failed work remains useful, and approval requires a meaningful human decision.

**Architecture:** Keep the Rust platform, real fits, GraphQL permissions, and evidence artifacts unchanged. Refactor only the React frontend. A persistent context strip sits above a three-region run workspace: linked ledger, interactive frontier, and selected evidence. The existing review mutation remains the only approval path, with a new UI acknowledgement gate before it can fire.

**Tech Stack:** Rust platform unchanged, GraphQL over typed fetch, React 19, TypeScript, Vite, hand-authored SVG charts, Playwright

---

## Product decisions

- The unit of UX is a defensible model decision, not a card or chart.
- The run opens on one visual comparison, not seven paragraphs.
- Dataset, target, exposure, scope, validation, baseline, branch, and review state stay visible.
- The frontier and ledger are two views of the same selection.
- Every failed experiment remains selectable and carries its measured reason.
- Evidence shows one decision-relevant chart at a time, with exact values on demand.
- Ask AI remains available but secondary to direct evidence.
- Review shows the material diff, the relevant evidence, every guardrail, and the weakest point.
- The human must acknowledge the sparse 3+ accident tail before the existing human-only approval mutation can run.
- No backend number is replaced with fixture data. Synthetic data stays clearly disclosed.

## File map

- Modify `frontend/src/api.ts`: expose the existing `datasetSummary` query to the frontend.
- Create `frontend/src/ContextStrip.tsx`: persistent provenance using `Run` plus `DatasetSummary`.
- Create `frontend/src/ExperimentLedger.tsx`: selectable compact experiment history.
- Modify `frontend/src/Frontier.tsx`: larger selectable experiment map with lineage and keyboard support.
- Modify `frontend/src/EvidencePanel.tsx`: one selected chart, evidence tabs, facts, exact-value table.
- Modify `frontend/src/ReviewView.tsx`: domain-aware review workspace and acknowledgement gate.
- Modify `frontend/src/App.tsx`: data loading, selection state, run/review composition, simplified copy.
- Create `frontend/src/workspace.css`: prototype contract and complete workspace layout layered over existing chart and Ask styles.
- Modify `frontend/src/main.tsx`: import the workspace stylesheet after base styles.
- Modify `frontend/e2e/*.spec.ts`: replace card-first assertions with linked-selection, evidence, context, and guarded-review assertions.

### Task 1: Add persistent model context

**Files:**
- Modify: `frontend/src/api.ts`
- Create: `frontend/src/ContextStrip.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] Add `DatasetSummary` with `rows`, `exposure`, `claims`, `frequency`, and `missingMileagePct`.
- [ ] Add `fetchDatasetSummary()` using the existing GraphQL `datasetSummary` resolver.
- [ ] Fetch dataset summary beside the latest run during boot.
- [ ] Render one persistent strip with Data, Target, Scope, Validate, and Baseline.
- [ ] Derive every variable figure from GraphQL. Keep only stable domain definitions as literal labels.

Expected visible contract:

```text
Data       100,000 policies · fixed seed
Target     BI claims / earned car year
Scope      Full synthetic auto book
Validate   5 folds + 2025 H2 holdout
Baseline   v12 · Gini from current run
```

### Task 2: Replace experiment cards with linked visual navigation

**Files:**
- Create: `frontend/src/ExperimentLedger.tsx`
- Modify: `frontend/src/Frontier.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] Add one `selectedCode` state in `App`.
- [ ] Select the latest landed experiment while running and the winner when complete, unless the user already selected another landed result.
- [ ] Render all seven experiments in a compact ledger with id, name, measured delta or skipped state, status mark, and one-line verdict.
- [ ] Make frontier dots keyboard and pointer selectable.
- [ ] Draw lineage from EXP-01 and EXP-04 into EXP-07 after the winner lands.
- [ ] Use status shape as well as color so the map remains legible without color.
- [ ] Keep running rows visible but disabled until evidence exists.

### Task 3: Make evidence the visual focus

**Files:**
- Modify: `frontend/src/EvidencePanel.tsx`
- Modify: `frontend/src/Chart.tsx`

- [ ] Keep lazy evidence loading by selected experiment.
- [ ] Compose archetype charts, lift, and folds exactly as today from backend artifacts.
- [ ] Replace the multi-chart grid with evidence tabs and one active chart.
- [ ] Keep existing hover, keyboard readout, legend toggles, and full-screen view.
- [ ] Add a collapsed `Exact values` table generated from the active chart series.
- [ ] Show fit facts in one compact strip.
- [ ] Preserve the honest refused-before-fit state for EXP-06.
- [ ] Label chart source as the selected experiment plus run id so a capture keeps its origin.

### Task 4: Turn review into a decision package

**Files:**
- Modify: `frontend/src/ReviewView.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] Preserve the backend review summary, guardrail rows, ledger rows, and evidence query.
- [ ] Reduce the default summary to one short decision statement and the one weak point.
- [ ] Show material changes as a compact before and after list derived from known winner semantics and live model metrics.
- [ ] Add evidence tabs for separation, age effect, accident tail, folds, and territory impact when those artifacts are available.
- [ ] Show all guardrails as a compact matrix with the backend explanation available through disclosure.
- [ ] Require `I reviewed the sparse tail` before enabling approval.
- [ ] Keep the existing `approveReview` call unchanged, preserving GraphQL role enforcement.
- [ ] After approval, show the actual returned model version and retain the run ledger.

### Task 5: Apply the actuarial working-paper contract

**Files:**
- Create: `frontend/src/workspace.css`
- Modify: `frontend/src/main.tsx`

- [ ] Put the full design contract at the top of `workspace.css`.
- [ ] Use continuous rules and aligned registers instead of floating card soup.
- [ ] Keep the current neutral and Prediction Lab blue palette. Assign green to passed, amber to caution, and red only to enforced failure.
- [ ] Use Inter for reading and the existing monospace voice only for ids, metrics, versions, and sources.
- [ ] Implement desktop as ledger / frontier / evidence with minmax-zero tracks.
- [ ] At tablet width stack evidence under frontier while keeping the ledger usable.
- [ ] At phone width place context, frontier, evidence, then ledger in one scroll direction.
- [ ] Give every control a visible drawn focus state and 44-pixel phone target.
- [ ] Reduced motion resolves directly to completed states.

### Task 6: Update tests and verify

**Files:**
- Modify: `frontend/e2e/screens.spec.ts`
- Modify: `frontend/e2e/evidence.spec.ts`
- Modify: `frontend/e2e/interactive.spec.ts`
- Modify: `frontend/e2e/sticky.spec.ts`
- Modify: `frontend/e2e/permissions.spec.ts` only if selectors change

- [ ] Typecheck the frontend.
- [ ] Build the frontend.
- [ ] Run Rust tests to prove backend behavior remained intact.
- [ ] Exercise frontier and ledger selection against the real API.
- [ ] Confirm every landed experiment yields evidence or an honest pre-fit refusal.
- [ ] Confirm context persists in run and review.
- [ ] Confirm approval is disabled before acknowledgement.
- [ ] Confirm the agent-role mutation remains rejected by the server.
- [ ] Capture completed run, selected failure, open review, approved review, 390 by 844 mobile, dark theme, and reduced motion.
- [ ] Grade for overflow, chart readability, selected-state clarity, hidden context, and accidental approval.

## Adversarial checks

- A user selects EXP-03, then the run finishes. The UI must not silently jump away from their selected failure.
- EXP-06 has no fit facts. The evidence region must show data-quality evidence, not an empty chart or fabricated metrics.
- A chart screenshot must retain experiment, run, target, and baseline context.
- The frontier cannot be the only way to select an experiment.
- Review cannot imply approval merely because it opened.
- A disabled approval button must explain the missing acknowledgement.
- Theme, plain terms, and Ask AI must not reset experiment selection.
- Mobile must not turn the wide workspace into horizontal page scrolling.

## Completion gate

The build is complete only when live backend artifacts drive the new workspace, all seven paths remain inspectable, approval is meaningfully gated, typecheck and backend tests pass, and the verified screenshots show a readable desktop and mobile decision flow.
