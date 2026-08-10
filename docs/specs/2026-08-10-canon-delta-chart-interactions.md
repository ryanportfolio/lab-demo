# Canon-delta chart interactions

Extends `2026-08-06-actuarial-chart-workspaces-design.md` (implemented) with the capabilities the finished evidence canon now supports. Evidence base: meta-review-r05 (`RESEARCH-LAB/prediction-lab-actuarial-ux/final/2026-08-10T18-56-36Z--meta-review-r05--claude-fable-5/`), independently audited (`…19-09-14Z--r05-verification-audit…`). Every requirement cites its canon claim; nothing here rests on taste.

## What the canon changed since the 08-06 spec

The 08-06 spec was written from single-pass evidence. The canon now has: the chart-work canon replicated across model families (L3-CAN-036..042, 5/7 fully); 23 new interaction-level claims (L3-CAN-044..066) from six blind runs; and the export/flattening mechanism confirmed as the best-corroborated claim in the campaign (L3-CAN-039). The deltas below are ordered by evidence strength × implementation leverage in this codebase.

## D1 — Exact-value table twin (L3-CAN-045, strong; 5/6 blind runs)

**Canon:** exact values are first-class evidence; every chart needs a synchronized exact-value table twin with bidirectional selection linking; hover-only detail gets bypassed via export. Charts are read as decorated tables (B6/DV-F01): interrogation means reaching the numbers.

**Current state:** the evidence strip shows exact values *for the pinned selection only*; the semantic table mirrors selection, not the full series.

**Spec:**
- Each chart gains a `Values` toggle rendering the full series as a real table beside/below the plot (layout per breakpoint), not only the selection.
- Bidirectional: clicking a table row pins the mark; pinning a mark highlights and scrolls the row. One selection model (`ChartSelection`) drives both — no second state.
- Every cell copyable; a row copy carries value + unit + denominator + baseline delta + experiment/run identity (the provenance the canon says detaches at export, L3-CAN-039).
- The table is the semantic/accessibility surface (replaces the current mirror-table role).
- Six-question check: the table answers Q4 (explanation) fully; Q3 probe = row click; continuity Q6 = table visibility state joins the URL (`tbl=1`).

**Files:** `Chart.tsx` (render + linking), `chartWorkspace.ts` (`selectionValues` generalizes to `seriesTable(chart)`), `workspace.css`.

## D2 — Effect-chart evidence floor: uncertainty beside estimates (L3-CAN-047/048, strong)

**Canon:** the learned literacy floor for factor/effect charts is four layers — observed, fitted, prediction ±2SE, exposure — with thin data flagged (Emblem pattern, regulator-trained audience). Uncertainty co-display is the floor, not an enhancement. Anti-requirement L3-CAN-037: never invent pass/fail thresholds on bare point estimates (already skill law).

**Current state:** age/segment/territory charts show exposure and weak points; **no SE/CI bands anywhere** — same silence the canon flags in Prediction Lab's public record (L3-CAN-027).

**Spec:**
- Backend: the Poisson GLM fit already yields coefficient standard errors; expose per-level `se` in the evidence chart payload for `age_curve`, `segment_effects`, `territory` (crates: fit result → API serializer).
- Frontend: ±2SE band rendered as a muted region around the fitted series; band, not error bars (continuous factors); per-level whiskers on categorical bars. Color-independent (pattern/opacity), off state announced.
- Thin-data cue: where exposure share < a stated fraction of book, the band widens visibly and the weak-point line names the thinnest level — the canon's "weak or thin area legible immediately" (Q2).
- No traffic-light coloring of band overlap (L3-CAN-048: traffic-light uncertainty rejected as trivializing; L3-CAN-037).

**Files:** `crates/*` (SE in payload), `api.ts` (types), `Chart.tsx` (band rendering), `chartWorkspace.ts` (weak-point uses SE).

## D3 — Point exclusion with visible recompute (L3-CAN-040 + BC-013 strong; L3-CAN-052 latency, moderate)

**Canon:** element-level chart manipulation that writes back to model state is the interaction practitioners buy tools for (Arius right-click-exclude; bidirectional dot↔grid). Incumbent loop is batch (mark → re-run → re-inspect); a conversational loop is a category-first *if* recompute is fast. State-mutating gestures must be separated from view gestures and carry a review trail.

**Current state:** selection is view-only; no write-back. The backend fits real GLMs at run time — the raw capability exists.

**Spec (prototype scope, one chart first):**
- On `age_curve` (richest factor chart): pinned selection exposes `Exclude from fit` — a *state-mutating* action visually distinct from view actions (placed with Save/Ask, marked as modifying).
- Exclusion writes an explicit exclusion set (level/range + who + when + free-text why, why required — L3-CAN-054 rationale capture), triggers a refit, and re-renders with: excluded marks kept visible but hollow (never silently vanish — the reviewer must see what was removed), fitted/SE series updated, and a delta strip "fit with/without" (comparison stays valid: same population minus named exclusions, L3-CAN-046).
- Latency contract: show `refreshing` state on the same geometry (state contract), target < 2 s on the synthetic book; if a refit exceeds it, the spec still holds — the queue indicator names the pending exclusion (dirty/refit status chip, BC-CAN-010).
- Review trail: exclusion sets are part of the experiment's evidence; the approval package lists them with rationale (L3-CAN-054: judgment layer is the least-captured, most decision-relevant data). Undo = remove from set + refit; full history kept.
- Guardrail: exclusions cannot be silent in the frozen package — a signed review that omits its exclusion list is invalid (completion-gate adversarial case).

**Files:** backend run endpoint (accept exclusion set, refit), `api.ts`, `Chart.tsx` (hollow marks, action), `EvidencePanel.tsx`/`ReviewView.tsx` (trail), `chartWorkspace.ts`.

## D4 — Judgment capture: indicated vs selected, bound to state (L3-CAN-053/054, strong)

**Canon:** the indicated-vs-selected-vs-booked layer with rationale is the most decision-relevant, least captured data in the workflow; annotations must bind to data subset + chart state + model version and surface resolve/changed/needs-revalidation when the version changes. Hard caveat (kept): some rationale is deliberately unrecorded — capture must be optional-with-defaults, never surveillance (BC-CAN-016 counter-tension).

**Current state:** the review/sign flow captures a verdict per experiment; nothing binds a judgment to a specific chart state.

**Spec:**
- `Save to review` grows a note field (optional) and records the full chart state it was made against (already mostly in `SavedChartEvidence` — add model/run version identity explicitly).
- If the underlying run is superseded (new fit, new exclusions), saved evidence shows a `superseded` badge and a one-click re-open-on-current-state diff — the export-reveals-when-superseded rule the 08-06 spec promised, now version-aware end to end (L3-CAN-044: the durable object is the versioned evidence state, not the rendering).
- The D3 exclusion rationale and these notes are the same annotation type (one schema: subject state + author + time + text + status).

**Files:** `chartWorkspace.ts` (`SavedChartEvidence` + status), `EvidencePanel.tsx`, `ReviewView.tsx`.

## D5 — Exhibit compilation from live states (L3-CAN-039 strong — best-corroborated; L3-CAN-056)

**Canon:** export strips context at every hop; decision exhibits are hand-rebuilt; governance requires frozen documents but verified-silence does not prohibit *generating* them from live states. The exploration→presentation last mile is the largest evidenced pain surface and Prediction Lab's own unshipped gap.

**Current state:** the frozen approval package exists and displays saved snapshots — the skeleton of exactly this. Delta is provenance density and self-containedness.

**Spec:**
- The approval package compiles each saved chart state into a static exhibit that carries, printed with the chart (not hover): question, selection, exact values for the pinned evidence, exposure/weak point, exclusion list + rationales, model/run version identity, and generation timestamp — the canon's companion set scaled to this app's stage (L3-CAN-038; we are pre-filing, so no SERFF-grade fields, and none invented).
- One action produces the whole package; regenerating after a data/model change diffs against the prior package rather than silently replacing it (L3-CAN-044).
- Every exhibit remains a link back to the live state it froze (reopen → exact state; already URL-carried).
- Static parity rule (L3-CAN-061): the frozen exhibit must be as legible as the interactive chart — no capability that exists only under hover survives compilation.

**Files:** `ReviewView.tsx`, `EvidencePanel.tsx`, print/package CSS; no backend change beyond version identity in payloads.

## D6 — Read-only interactive share (L3-CAN-057, strong-moderate) — deferred, named

Author/viewer split is established practice (Radar Dashboard) and the missing piece is read-only-but-interactive with provenance. This app is a single-user prototype; deferred until multi-user exists. Recorded so the gap is a decision, not an omission.

## Priority and sequencing

1. **D2** (SE bands) — smallest change, closes the floor gap the canon flags for the product category itself.
2. **D1** (table twin) — direct hit on the strongest chart-specific convergence in the canon.
3. **D3** (exclusion + refit) — the differentiating interaction; largest build; lands the category-first loop the canon says nobody documents.
4. **D4** (judgment capture) — rides on D3's annotation schema.
5. **D5** (exhibit compilation) — upgrades the existing package; do after D1–D4 so exhibits inherit their evidence.
6. D6 deferred.

## Completion gate additions (beyond 08-06 gate)

- Adversarial case for D3: attempt to sign a review whose package omits an active exclusion — must be impossible; the package must show the hollow excluded marks.
- Adversarial case for D2: a thin level must be identifiable from the static exhibit alone (no hover).
- Uncertainty display never colors pass/fail on a point estimate (L3-CAN-037/048).
- Validation debt (L3-CAN-063): chart pain is latent — none of this canon evidence is a substitute for watching a practitioner use these features; the canon's top open question (observe the anomalous-point interrogation sequence) stands. Record usage friction from the owner's own sessions as the nearest available observation.
