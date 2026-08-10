# Chart + Ask Split Workspace (full-screen) Implementation Plan

> **For agentic workers:** Implement this plan task-by-task, in order. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The full-view chart becomes a full-screen split workspace — chart on the left, a docked Ask chat on the right with persistent per-run sessions — so a selection and its explanation are visible at the same time.

**Architecture:** Extract the chat transcript/composer from `AskPanel` into a shared `AskChat` component (the ⌘K modal keeps its exact behavior by wrapping it). `Chart`'s existing full view gains a controlled `expanded` prop and an optional `askRail` ReactNode slot; when the rail is present the scrim renders an edge-to-edge `.chart-studio` flex split instead of the centered dialog. `EvidencePanel` owns the rail: it builds the `AgentAsk` seed from the pinned selection, routes card/full-view "Ask about selection" into the rail on wide viewports (falling back to the modal below 1100px), and records `full=1` in the evidence URL. Sessions persist in localStorage keyed by run.

**Tech Stack:** React 18 + Vite + TypeScript, Playwright e2e (no unit test runner in `frontend/`), deterministic `ask` GraphQL endpoint (no live model — answers are reproducible in e2e).

**Decision framing (chart-workspace skill):** This kills the detached-chat anti-pattern: today "Ask about selection" opens a modal that covers the chart, and the full view (`body.chartfull`) and Ask modal are mutually exclusive. After this change the pinned selection, denominator/source line, weak point, and the answer explaining them share one screen. Threads are local-only state and are labeled as such in the UI.

## File structure

- Create: `frontend/src/askThreads.ts` — thread persistence (load/save/delete, caps), no React.
- Create: `frontend/src/AskChat.tsx` — transcript + composer + suggested questions + send logic + optional sessions UI (used by both modal and rail).
- Modify: `frontend/src/AskPanel.tsx` — becomes scrim/dialog wrapper around `AskChat`; behavior unchanged.
- Modify: `frontend/src/Chart.tsx` — controlled `expanded`, `askRail` slot, `.chart-studio` split rendering.
- Modify: `frontend/src/chartWorkspace.ts` — `updateEvidenceUrl` learns `full`.
- Modify: `frontend/src/EvidencePanel.tsx` — rail construction, seed routing, `full=1` URL, `onCite` plumb.
- Modify: `frontend/src/App.tsx`, `frontend/src/ReviewView.tsx` — pass `onCite` (reveal experiment) down to `EvidencePanel`.
- Modify: `frontend/src/styles.css` — `.chart-studio` split layout, rail chrome, sessions flyout.
- Create: `frontend/e2e/ask-rail.spec.ts` — split workspace, seeding, sessions, narrow fallback.

---

### Task 1: `askThreads.ts` — session persistence

**Files:** Create `frontend/src/askThreads.ts`

- [ ] Types: `StoredTurn` = `Answer & { display?: string; chip?: string }` (import `Answer` from `./api`); `AskThread { id, runId, title, createdAt, updatedAt, turns: StoredTurn[] }`.
- [ ] Storage key `plab-ask-threads`, shape `Record<runId, AskThread[]>`. All reads/writes in try/catch (private mode / quota).
- [ ] `loadThreads(runId): AskThread[]` sorted newest-updated first.
- [ ] `saveThread(thread)` — upsert by id, cap 12 threads per run, cap store at 6 runs (drop the run with the oldest `updatedAt`).
- [ ] `deleteThread(runId, id)`.
- [ ] `newThreadId()` — `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.
- [ ] Verify: `npx tsc --noEmit` passes.

### Task 2: Extract `AskChat` from `AskPanel` (behavior-preserving)

**Files:** Create `frontend/src/AskChat.tsx`; modify `frontend/src/AskPanel.tsx`

- [ ] `AskChat` props: `{ runId, ready, plain, open, onCite, seed, threadKey? }`. It owns `q/chip/suggested/answers/busy/error` state, `send()` (chip carry rules unchanged), scroll-to-new-turn, textarea autosize, intro, transcript, followups, `.ask-foot` composer. Renders `null` when `!open` **after** hooks so state survives close (matches today's modal behavior).
- [ ] When `threadKey` (a runId) is set: on mount load newest thread into `answers`; persist to `askThreads` after each answer; render a compact sessions strip (Sessions flyout: switch / delete; New session button; "Saved in this browser only" note).
- [ ] `AskPanel` keeps scrim, dialog chrome, Esc, scroll-lock, focus; body/foot replaced by `<AskChat … threadKey={undefined} />`. DOM classes (`.ask`, `.ask-body`, `.ask-row`, `.ask-sugg`, …) unchanged.
- [ ] Verify: `npx tsc --noEmit`; e2e `interactive.spec.ts` still passes (modal flow untouched).

### Task 3: `Chart` — controlled expansion + rail slot + split layout

**Files:** Modify `frontend/src/Chart.tsx`

- [ ] Add optional controlled props `expanded?: boolean; onExpandedChange?(next: boolean)` following the existing `selection`/`mode` controlled pattern (local state fallback).
- [ ] Add `askRail?: ReactNode`. When set and full view open, scrim gets class `chart-scrim studio` and renders `<div class="chart-studio"><figure class="chart chart-full chart-full-split">…</figure><aside class="chart-studio-rail" aria-label="Ask about this chart">{askRail}</aside></div>`. Without `askRail` (answer mini-charts, narrow viewports) the centered dialog renders exactly as today — `interactive.spec.ts` expands a context-less chart from inside the modal and must not change.
- [ ] Full-view "Ask about selection" continues to call `context.onAsk` (routing is EvidencePanel's job, Task 5).
- [ ] Esc/scrim-click close via the expansion setter; `body.chartfull` handling unchanged.
- [ ] Verify: `npx tsc --noEmit`; e2e `chart-workspace.spec.ts` full-view test still passes (`.chart-full` locators preserved).

### Task 4: `updateEvidenceUrl` learns `full`

**Files:** Modify `frontend/src/chartWorkspace.ts`

- [ ] Add `full?: boolean | null` to the updates object: `if ('full' in updates) set('full', updates.full ? '1' : null);`.
- [ ] Verify: `npx tsc --noEmit`.

### Task 5: `EvidencePanel` — rail, seed routing, URL, `onCite`

**Files:** Modify `frontend/src/EvidencePanel.tsx`, `frontend/src/App.tsx`, `frontend/src/ReviewView.tsx`

- [ ] `railWide` state from `window.innerWidth >= 1100` with resize listener.
- [ ] `expanded` state initialized from `?full=1`; every expand/collapse writes `updateEvidenceUrl({ …, full })`.
- [ ] `railSeed: AgentAsk | null` state. The workspace context's `onAsk` becomes: wide → `setExpanded(true); setRailSeed(ask)`; narrow → existing `props.onAsk` (modal). Card and full-view Ask buttons both flow through this.
- [ ] Rail node (only when `railWide` and the chart has context): header (`AI` mark, chart title, "Sessions" affordance lives inside `AskChat`) + `<AskChat runId ready plain open onCite={handleCite} seed={railSeed} threadKey={runId} />`. `handleCite` closes the full view then calls the new `onCite` prop.
- [ ] New optional `onCite?: (code: string) => void` prop on `EvidencePanel` and `ReviewView`; `App` passes `revealExperiment` to both.
- [ ] A live "Asking about" context rides the seed (existing `AgentAsk.context` chip) — pinned selection, mode, target/denominator, run id all travel, per the ask-from-selection contract.
- [ ] Verify: `npx tsc --noEmit`.

### Task 6: Styles

**Files:** Modify `frontend/src/styles.css`

- [ ] `.chart-scrim.studio { padding: 0 }`; `.chart-studio { display: flex; width: 100%; height: 100dvh }`.
- [ ] `.chart-full-split { flex: 1 1 auto; min-width: 0; width: auto; max-width: none; max-height: none; height: 100%; border-radius: 0; box-shadow: none }` — svg fit rules (`.chart-full > svg…`) still apply.
- [ ] `.chart-studio-rail { flex: 0 0 420px; min-width: 0; display: flex; flex-direction: column; border-left: 1px solid var(--border); background: var(--card) }` — reuses `.ask-body` / `.ask-foot` styling for the interior.
- [ ] Sessions strip + flyout: visible-clickable buttons (owner rule: clickables look clickable), positioned panel inside the rail, keyboard focusable, `--r-*`/`--border` tokens, works in all four themes (vars only).
- [ ] Verify visually via dev server on desktop width and a ~900px window (rail absent, dialog fallback).

### Task 7: E2e

**Files:** Create `frontend/e2e/ask-rail.spec.ts`

- [ ] Wide viewport (config default 1280): expand age_curve → `.chart-studio-rail` visible, `.chart-full` fills viewport; suggested question → `.ask-row.ai` renders (deterministic backend).
- [ ] Pin a selection on the card → "Ask about selection" → studio opens with composer pre-filled (`Explain`) and chip context showing the selection; sending yields an answer.
- [ ] Sessions: after an answer, reload with the recorded URL (`full=1` present) → transcript restored from localStorage; New session empties; flyout switches back.
- [ ] Citation in rail closes the studio and reveals the cited experiment.
- [ ] Narrow viewport (`page.setViewportSize({ width: 900, … })`): expand → no rail, centered dialog; card Ask opens the modal.
- [ ] Run the full suite: `PLAB_URL=http://localhost:5273 npx playwright test` — all specs green.

### Task 8: Ship

- [ ] `npx tsc --noEmit` clean, full e2e green, desktop + narrow screenshots taken for the PR.
- [ ] Commit, push branch, open PR (body via `--body-file` from `.tmp/`).

## Self-review notes

- `interactive.spec.ts` expands a chart inside the ask modal (no `context`) — Task 3 keeps the context-less dialog path byte-identical.
- Modal `AskPanel` stays ephemeral (in-memory across open/close, as today); only the rail persists threads. Divergence is deliberate: modal = quick run-wide question, rail = chart deep-dive sessions.
- Esc while typing in the rail closes the studio (chart's capture handler). Accepted for now; thread persistence means nothing is lost.
- Thread ids/timestamps use `Date.now()` in app code (allowed — restriction applies to workflow scripts only).
- `full=1` in the URL restores the split; thread contents are local-only and the rail says so.
