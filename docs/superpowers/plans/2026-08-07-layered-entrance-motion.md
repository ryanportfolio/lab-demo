# Layered Entrance Motion Implementation Plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Greptile-referenced blur-to-focus entrance that preserves Prediction Lab geometry, then use a restrained evidence fade-through for in-session updates.

**Architecture:** CSS owns initial reveal choreography through stable component and SVG-layer classes. `EvidencePanel` owns a single 220ms update transition without remounting the last valid artifact. Root motion preferences settle every layer immediately.

**Tech Stack:** React 19, TypeScript, CSS animations/transitions, Playwright.

---

### Task 1: Motion contract and entrance layers

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/Chart.tsx`
- Modify: `frontend/src/workspace.css`

- [ ] Add stable shell, goal, ledger/frontier, evidence, chart, diagnostic, and action layer selectors.
- [ ] Animate only `opacity`, `filter`, and `transform`; use 5px blur, no more than 6px translation, 480–560ms durations, and 70ms staggering.
- [ ] Group chart axes, exposure, primary evidence, and diagnostics so chart meaning resolves in that order without changing SVG geometry.

### Task 2: Restrained evidence updates

**Files:**
- Modify: `frontend/src/EvidencePanel.tsx`
- Modify: `frontend/src/workspace.css`

- [ ] Replace the immediate `resolve(update)` helper with a local transition coordinator.
- [ ] Hold current evidence for the 90ms fade-out, swap state once, and resolve over the remaining 130ms.
- [ ] Skip the transition for `.no-anim` and `prefers-reduced-motion`.

### Task 3: Determinism and regression proof

**Files:**
- Modify: `frontend/src/styles.css`
- Modify: `frontend/e2e/chart-workspace.spec.ts`

- [ ] Force all reveal layers to settled values under `?noanim=1` and reduced motion.
- [ ] Assert normal entrance starts blurred/transparent and settles without bounding-box movement.
- [ ] Assert experiment and tab changes use 160–240ms component transition, preserve node identity, and do not replay entrance layers.
- [ ] Run `npm run typecheck`, `npm run build`, `npm run shots`, and `git diff --check`.
