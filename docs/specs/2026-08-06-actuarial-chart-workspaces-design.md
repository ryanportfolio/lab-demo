# Actuarial Chart Workspaces Design

## Outcome

Turn every evidence chart from a passive report into a decision-bearing working surface. The system must support **see → isolate → compare → explain → act → preserve** while retaining exact actuarial context.

## Decision frame

- User: pricing actuary examining experiments; pricing lead reviewing the candidate.
- Stage: exploration and model-candidate review, not filing or deployment.
- Target: Bodily Injury claim frequency.
- Denominator: earned car year.
- Baseline: approved model v12.
- Active slice: full synthetic auto book unless a chart selection narrows it.
- Guardrails: at most two new factors, territory movement within 5%, improvement across five folds.
- Consequence: retain, investigate, or reject an experiment; a human may later keep the candidate.

## Product contract

Every chart answers six questions:

1. What decision question does it answer?
2. What pattern and weak point are visible immediately?
3. What mark or valid range can be isolated?
4. What exact values, weight, limitation, and source explain the selection?
5. What valid comparison, diagnostic, or agent question follows?
6. Can this exact state be reopened, shared, cited, and carried into review?

The default view stays sparse. Interaction reveals depth without hiding critical evidence in hover.

## Universal interaction grammar

- Hover/focus previews the nearest mark.
- Click/tap/Enter pins it.
- Escape clears it.
- Arrow keys traverse marks; Shift+Arrow extends a valid ordered range.
- One selection drives the plot, exact table, source, agent question, and review evidence.
- The last valid artifact remains visible while another loads.
- URL state preserves experiment, chart, comparison mode, and pinned selection.
- Saved evidence carries the immutable chart context into the decision package.

## Semantic capability matrix

| Chart kind | Question | Selection | Comparison | Weight / weak point | Guardrail |
|---|---|---|---|---|---|
| Age relativity | Does the spline reveal stable age shape beyond v12 bands? | Point and age range | Relativity or percent change from v12 | Earned exposure; thin ages | None |
| Prior accidents | Does capped history explain observed frequency without pricing sparse counts? | Count | Observed against fitted gap | Exposure share; counts 3+ | None |
| Territory | How far would blended relativities move the filed table? | Zone | Blended against filed; percent movement | Largest movement | ±5% territory limit |
| Count distribution | Does the alternate family explain the observed count distribution? | Count | Expected families against observed | Largest residual | None |
| Interaction | Does the interaction explain residual frequency in a credible cell? | Cell | Observed against expected | Cell exposure share | None |
| Missingness | Where is mileage missing most, and do missing policies have different frequency? | Region or status, in separate views | No cross-unit overlay | Worst region / missing-status gap | Data-quality stop, not numeric model guardrail |
| Segment effects | Which factors drive the selected segment away from book average? | Contribution | Factor contribution against 1.00 | Largest contribution | None |
| Separation | Does ordering improve against v12 across risk deciles? | Point and decile range | Current against v12; observed against predicted | Equal-exposure deciles | None |
| Validation folds | Does the gain survive every held-back fold? | Fold | Delta against zero | Weakest fold | Improvement must remain above zero |

No control appears where the statistical meaning or available data cannot support it. Missing capabilities are disabled with a specific reason rather than simulated.

## Selection explanation

A pinned selection shows a compact evidence strip:

- selected point or range;
- exact visible series values;
- baseline delta where valid;
- selected exposure and share where available;
- weak-point or guardrail status;
- source: experiment, run, chart, target, denominator, and active comparison.

Actions are `Ask about selection`, `Save to review`, `Copy evidence link`, and `Clear`. The agent receives the full selection context and cannot approve.

## Preservation

The URL carries `exp`, `chart`, `mode`, and `sel`. Reopening restores the same evidence state. Saving creates a local prototype evidence snapshot with question, selection, values, source, and weak point. The decision package displays saved snapshots. Local-only persistence is labeled; it is not represented as server collaboration.

## State and accessibility

- Empty, loading, ready, refreshing, error, and stale presentations retain stable geometry.
- Refreshing and errors keep the last valid artifact visible and labeled.
- Pointer, keyboard, and touch have equivalent paths.
- Selection and guardrails use shape/text as well as color.
- A semantic exact-values table mirrors selection.
- Screen readers receive selection and state announcements.
- Reduced motion removes transitions without hiding state.

## Verification

- Component behavior tests for hover, pin, range, comparison, reset, URL restoration, copy, save, ask, keyboard, and unsupported controls.
- Visual checks at 1920×1080 and 390×844 for default, pinned, range, guardrail, and review states.
- Loading/error geometry check.
- Requirement matrix audit against every chart kind.
- No horizontal overflow, hidden critical facts, invented data, or detached agent context.

Final evidence: 24/24 browser tests, full Rust workspace tests, TypeScript typecheck,
production build, and `git diff --check` pass. Exact captures cover 1920×1080 and
390×844; the mobile document remains 390px wide. Pinning and comparison preserve
the selected-evidence height and downstream review position.
