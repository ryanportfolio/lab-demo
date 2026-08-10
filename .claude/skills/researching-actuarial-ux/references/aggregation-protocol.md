# Multi-run aggregation protocol

## Principle

Synthesize evidence, not prose. Deduplication must be reversible. Agreement among reports is useful only after separating independent reasoning from repeated underlying sources.

## 0. Resolve campaign artifacts

Use the caller-supplied campaign directory. Otherwise resolve the user's Desktop and use `RESEARCH-LAB/<campaign-id>/`, with `prediction-lab-actuarial-ux` as the default campaign ID. Request narrowly scoped write approval if the existing folder is protected by a sandbox; use `research/actuarial-ux/<campaign-id>/` only if Desktop is unavailable, approval is denied, or writing remains impossible, and disclose cross-worktree limitations. Inventory every Markdown report in `runs/`; do not assume reports embedded only in earlier chats are discoverable. Reserve `synthesis/YYYY-MM-DDTHH-mm-ssZ/` for all aggregation outputs and return its exact absolute path.

## 1. Validate inputs

Inventory every report with run ID, model, date, scope, lens, blindness status, source count, and source classes. Keep contaminated or non-blind runs, but never count them as independent convergence without qualification.

The manifest artifact must also declare, non-optionally:

- **The synthesis pass's own model identity** (not just the input models).
- **A synthesis-level blindness statement:** the exact files read, plus an explicit declaration that nothing under `synthesis/` or `final/` was read and whether any web access occurred. If the operating session was exposed to any prior synthesis or review, disclose it and label the pass non-blind — asserted blindness that the session context contradicts is worse than declared contamination.
- **SHA-256 for every input file**, computed at read time.
- **A no-modification statement** covering all input files. If new evidence must be attached to a raw run after its completion, never alter the body: append a dated, clearly demarcated, non-blind-labeled addendum, and note in the manifest that the run's file hash changed.

These four fields exist because their absence forced expensive reconstruction in a later review cycle (meta-review-r04/r05, 2026-08-10): three of four audited passes lacked input hashes, their own model, or a blindness statement.

**Collision guard:** before starting, list the target `synthesis/` (names only — listing preserves blindness) and reserve your output directory immediately. If a same-scope synthesis appears mid-flight, stop publishing a competitor and switch to audit/annex mode against it. Parallel sessions have produced duplicate syntheses, duplicate reviews, and thrice-reused run IDs in one day (2026-08-10).

## 2. Build master ledgers

Create:

- A source ledger keyed by canonical URL and underlying-source fingerprint
- An atomic finding ledger preserving every original finding ID
- A terminology map for synonyms without rewriting original evidence

## 3. Normalize findings

Compare actor, decision/job, workflow stage, mechanism, consequence, and evidence. Merge only when these materially match. Similar wording is insufficient; different wording does not imply difference.

Assign each canonical cluster an ID such as `CAN-014`. Record every member finding and why it was merged. Use relationship labels when findings are not duplicates: `supports`, `extends`, `narrows`, `contradicts`, `alternative cause`, or `distinct segment`.

## 4. Measure convergence honestly

For every canonical finding report separately:

- Number of reports containing it
- Number of blind independent runs containing it
- Number of unique underlying sources
- Number and kind of independent source classes
- Products, personas, and workflow stages represented
- Credible challenging evidence

Do not convert these counts into false-precision scores.

## 5. Set confidence

- **Strong:** direct evidence or multiple independent, current, relevant sources across useful classes; no unresolved contradiction that changes the claim.
- **Moderate:** one high-quality direct source or several consistent indirect sources with bounded limitations.
- **Tentative:** inference, vendor-only evidence, sparse context, weak independence, or uncertain transferability.
- **Contested:** credible evidence supports materially different interpretations, segments, or outcomes.

Confidence describes evidence for the claim, not confidence in a proposed interface.

## 6. Preserve disagreement and novelty

Keep minority findings when they expose severe harm, excluded users, a distinct workflow, a plausible alternative cause, or a strategically important unknown. Record negative evidence and failed confirmation. Never delete a finding merely because only one model found it.

## 7. Produce aggregation artifacts

1. **Executive synthesis:** strongest established findings, strategic tensions, and unknowns.
2. **Canonical findings:** claim, actor/workflow, mechanism, consequence, confidence, source diversity, Prediction Lab relevance, and validation need.
3. **Convergence matrix:** reports, blind runs, unique sources, source classes, segments, and contradictions.
4. **Dedupe map:** every original finding ID → canonical ID or explicit retained-outlier reason.
5. **Master source ledger:** canonical sources, fingerprints, duplicate appearances, and limitations.
6. **Contradiction and outlier register:** competing claims, contexts, and evidence needed to resolve them.
7. **Coverage gaps:** missing products, users, geographies, stages, and source classes.
8. **Research backlog:** next questions ranked by decision value and best validation method.
9. **Design opportunity brief:** only evidence-supported requirements or questions; speculative solutions remain labeled.

## Completion gate

- The manifest declares the pass's own model, a synthesis-level blindness statement, per-input SHA-256, and a no-modification statement (§1).
- Every input report and finding is accounted for.
- Every merge can be reversed from the dedupe map.
- Repeated URLs and syndicated sources are not counted as independent evidence.
- Confidence follows the evidence rubric.
- Contradictions and important one-off findings remain visible.
- The synthesis distinguishes what is observed, reported, inferred, unknown, and proposed.
- Every aggregation artifact is saved under the reserved synthesis directory and its absolute path is reported.
