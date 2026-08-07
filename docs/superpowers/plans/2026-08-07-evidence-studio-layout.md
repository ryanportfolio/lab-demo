# Evidence Studio Layout Implementation Plan

**Goal:** Replace the three equal-height desktop columns with an evidence-first working-paper composition that uses the full canvas and removes the nested chart scrollbar.

**Architecture:** Keep the existing React DOM and state flow. Use desktop CSS grid areas to place selected evidence as the dominant left stage and stack the experiment ledger plus frontier as a right memory rail. Inside the focused chart, use a second grid to keep the plot large while placing weakness, provenance, selection, method notes, and actions in a stable diagnostic rail. Revert to the existing linear flow below the desktop breakpoint.

**Tech stack:** React 19, TypeScript, CSS Grid, Playwright.

---

## Task 1: Encode the geometry contract

**Files:**
- Modify: `frontend/e2e/chart-workspace.spec.ts`

Add a 1920px test asserting that evidence sits left of the ledger, is materially wider than the experiment rail, the ledger and frontier share a rail, the chart has no nested vertical scrolling, and the document has no horizontal overflow. Preserve narrow-screen order and containment assertions.

## Task 2: Build the evidence-first desktop composition

**Files:**
- Modify: `frontend/src/workspace.css`

Define named grid areas for evidence, ledger, and frontier. Give evidence the dominant column; stack memory surfaces at right. Remove fixed evidence/chart heights and the forced evidence minimum height. Preserve the selected-experiment spine and working-paper borders.

## Task 3: Turn chart chrome into a diagnostic rail

**Files:**
- Modify: `frontend/src/Chart.tsx`
- Modify: `frontend/src/workspace.css`

Add semantic wrappers only where CSS needs stable placement. Lay out title, y-axis readout, plot, and legend in the main chart column. Place weakness, provenance, pinned-selection actions, and method notes in the adjacent diagnostic column. Keep all interaction logic unchanged.

## Task 4: Preserve responsive and motion behavior

**Files:**
- Modify: `frontend/src/workspace.css`
- Verify: `frontend/e2e/chart-workspace.spec.ts`
- Verify: `frontend/e2e/screens.spec.ts`
- Verify: `frontend/e2e/sticky.spec.ts`

Below 1240px, restore the two-column/tablet layout; below 820px, restore the linear frontier → evidence → ledger order and single-column chart. Keep entrance animation geometry stable; keep `?noanim=1` and reduced motion settled immediately.

## Task 5: Verify and integrate

Run typecheck, production build, safe Playwright behavior/screenshot tests, and Rust workspace tests. Capture settled desktop and mobile screenshots. Stage intentional source/test/plan files only, then use the active Auto-Merge workflow to commit, push, open or reuse a PR, merge via squash, and re-sync the session branch.
