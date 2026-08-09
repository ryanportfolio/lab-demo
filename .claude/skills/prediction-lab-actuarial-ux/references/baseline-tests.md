# Baseline skill tests

Run before authoring the skill on 2026-08-06 using three clean agent contexts. Edit-round tests from 2026-08-08 appended at the end.

## Scenario 1: interview dashboard under time pressure

The baseline agent immediately proposed “validation RMSE,” “training steps,” actual-vs-predicted, residuals, and a “Promote run” action. The visual advice was competent but generic. It lost insurance target, exposure, actuarial diagnostics, guardrails, failure memory, provenance, and human review semantics.

## Scenario 2: insurance AI approval

The baseline agent produced a long governance checklist with reauthentication, traffic caps, security checks, protected-class analysis, and multiple sign-offs. Some controls may matter in production, but the screen became compliance inventory rather than a focused model decision. It assumed deployment approval and hid the weak-point review behind process volume.

## Scenario 3: incumbent actuarial product critique

The baseline agent correctly identified lineage, data quality, actuarial language, review, and habituation. It still defaulted to a generic pipeline and comparison cockpit. It did not recover Prediction Lab's three AI layers, persistent evidence spine, failure memory, exact-plus-visual artifacts, or the latent signals revealed by screenshots, copied models, Excel, and reviewer reconstruction.

## Skill requirements derived from failures

- Force insurance semantics before generic ML defaults.
- Start from Prediction Lab's real product direction and three complementary AI roles.
- Center decision continuity and latent workarounds, not feature inventory.
- Keep governance proportional to the actual decision.
- Require material diff, weak point, evidence provenance, failure memory, bounded AI, and intentional human judgment.

## Green and refactor results

With the skill loaded, the dashboard scenario replaced RMSE and training-step defaults with persistent actuarial context, holdout Gini, calibration, Lorenz evidence, exposure, failure memory, provenance, and a human decision gate. The incumbent critique reorganized around decision continuity and named the latent workarounds explicitly.

The first approval retest still imported deployment controls into a model-candidate gate. The skill was tightened to require gate classification and stage-appropriate governance. The second retest produced a compact candidate-retention package and explicitly excluded filing, rollout, production monitoring, fairness certification, and reauthentication unless triggered by a later gate. The observed loophole was closed.

## Edit round 2026-08-08 (evidence-audit calibration)

Driven by the meta-review `final/2026-08-08T00-47-11Z--meta-review-r02--claude-fable-5/` (tensions T-2, T-6; negative evidence N-2). Two scenarios, fresh Sonnet contexts, current skills loaded; rubric locked before running.

**Scenario A — Excel-replacement review surface (commercial pricing, external formula auditors).** Baseline held gate discipline and produced stamped exports, but asserted a value-diff table "is the direct replacement for formula inspection" with no validation requirement for the formula-auditing stakeholders, and claimed stamped exports "cannot drift" with no superseded marking.

**Scenario B — "fast iteration" workspace for nested-stochastic life valuation under sales pressure.** Baseline invented an unevidenced platform capability (sub-minute proxy re-projection engine) and presented it as designable fact. Latency structure itself was handled well (preview vs. confirmed, convergence flag), so a planned latency-budget rule was dropped as a no-op. A planned failure-memory caution was also dropped: neither baseline over-built failure memory.

**Edits derived:** formula-review replacement must be validated with formula-auditing stakeholders (wisdom design stance + review-checklist question); exports reveal as-of version and supersession (chart-skill Preserve row + checklist); sign-off-without-old-file and record-only reconstruction probes (checklist); computation class in the decision frame and unevidenced platform capabilities named as dependencies, not features (SKILL step 2 + product-context scope note).

**Retest (same prompts):** Scenario B named the computation class and declared the proxy engine "assumed platform capabilities, not confirmed product features," instructing the team to flag it to the prospect. Scenario A designed a formula-trace surface, flagged it as the largest platform dependency requiring validation with the two audit stakeholders, and made superseded review packages self-marking. No governance bloat or gate regression appeared; no refactor round was needed. Single run per scenario per phase — same n as the 2026-08-06 rounds.

## Probe round 2026-08-09 (adaptive interfaces vs reconstructable review) — no-op

Candidate failure mode from an AI-native-software talk review: dynamically generated, per-reviewer review interfaces could make the sign-off view unreconstructable. Rubric locked before running: pass requires the generated sign-off view treated as a versioned artifact (or refusal of per-reviewer variability on reconstruction grounds) plus intact gate discipline.

**Scenario C — "adaptive review surface" generated per decision, tailored per reviewer.** One fresh Sonnet context, current skills loaded. Result: PASS unprompted — the design pinned the composition as a versioned immutable artifact before rendering, required re-render from the artifact rather than live regeneration, named "what did this actuary actually see when they signed off" as a hard sign-off requirement, refused divergent evidence sets across reviewers and non-reproducible regenerate-on-open, and structurally filtered later-gate governance out of the eligible-module set.

**Edits derived: none.** The 2026-08-08 record-only-reconstruction and sign-off probes already cover this failure mode. Logged per the no-edit-without-observed-failure rule. n=1, single scenario.

## Edit round 2026-08-09 (meta-review-r03 calibration)

Driven by the meta-review `final/2026-08-09T21-00-37Z--meta-review-r03--claude-fable-5/` (L3-CAN-041 thresholdless canon, ADJ-10 Gini noise, DR-10 holdout-provenance guardrail candidate) and its DR-coverage audit of this repo (live ΔGini zero-line with breach fill, in-sample lift unlabeled, dead Plain-terms layer). Two scenarios, fresh Sonnet contexts, current skills loaded; rubric locked before running; single run per scenario per phase.

**Scenario D — model-quality section whose sketch is a "Gini improves in all 5 folds ✓" lamp** (fold deltas +0.3 to +1.4 points, train Gini given, holdout present but unshown, lift staircase of ambiguous provenance). Baseline killed the lamp and labeled train vs holdout on the artifact unprompted, so the planned holdout-provenance probe was dropped as a no-op (caveat: that catch leaned partly on repo comments that state the discipline). But it produced zero uncertainty context: no standard-error reasoning anywhere, sub-SE fold deltas read as "real signal about stability," and per-fold pass/fail dots re-created the zero-crossing lamp it had just deleted.

**Scenario E — Plain-terms gloss computed, stored, and fetched but rendered nowhere; team proposes shipping with "the gloss stays in the API for later."** Baseline PASSED unprompted: no-ship, restore-or-make-the-cut-explicit, named the explaining-state-in-chat smell test, demanded regression-proof gloss assertions. Planned reachability probe dropped as a no-op; the underlying frontend regression was spun off as a code task instead of a skill edit.

**Edits derived:** metric differences carry the uncertainty that decides whether they are signal (standard error, fold spread, exposure) and are never graded by an invented pass mark or zero-crossing (review-checklist, Actuarial meaning); the chart-skill Guardrails row now separates filing/stated-goal constraints from invented model-quality pass marks and forbids pass/fail coloring on bare point estimates.

**Retest (same prompt):** the design opened by naming the three populations behind the three artifacts, refused any check or color grading on point estimates, treated fold spread as the uncertainty signal where no SE is computed ("whether +0.3 is a real effect or noise"), reused the platform's categorized judgment language instead of badges, flagged the app's own live zero-line breach fill and its unrendered per-fold pass boolean for removal, and held the real-vs-invented threshold line (filed territory tolerance stays a guardrail; a fold count does not). Provenance labeling stayed at baseline strength. No gate regression, no governance bloat, no refactor round needed. n=1 per scenario per phase, same as prior rounds.
