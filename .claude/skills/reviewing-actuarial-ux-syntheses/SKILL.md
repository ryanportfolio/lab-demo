---
name: reviewing-actuarial-ux-syntheses
description: Use when comparing, reviewing, reconciling, adjudicating, or finalizing multiple completed actuarial UX synthesis passes, especially Prediction Lab research syntheses, before using findings for product or design decisions.
---

# Reviewing actuarial UX syntheses

## Core principle

This is a terminal evidence audit, not a vote among summaries. Agreement across synthesis passes measures interpretive stability; evidence strength still comes from unique raw reports, source fingerprints, source classes, directness, relevance, recency, and credible challenge.

## Input boundary

1. Read `references/meta-synthesis-protocol.md` and `references/final-output-template.md` completely.
2. Use a caller-supplied campaign directory when present. Otherwise resolve the user's Desktop and use `RESEARCH-LAB/prediction-lab-actuarial-ux/`. Request narrowly scoped filesystem approval if that existing folder is sandbox-protected; use repository fallback `research/actuarial-ux/prediction-lab-actuarial-ux/` only if approval is denied or Desktop remains unavailable.
3. Discover completed layer-two pass directories under `synthesis/`. Recognize artifact roles from content and structure, not exact filenames alone. Freeze and hash the input manifest before analysis. Never add a pass that appears after the freeze.
4. Exclude `final/`, previous layer-three outputs, partial output directories, and raw `runs/` reports from the primary input set. Do not browse the web or introduce new external evidence. If only one valid synthesis exists, perform a pass-quality audit but make no cross-pass convergence claim.
5. Do not read a previous final before the current review is frozen. Read one only when the user explicitly requests a legacy delta audit; it contributes zero evidence and imports nothing without raw lineage.

## Review workflow

1. Inventory every pass and artifact. Assign chronological aliases `P01`, `P02`, and so on; record path, hashes, model, date, input-report hashes, blindness, contamination, and missing artifacts.
2. Assess each pass using the protocol's separate quality dimensions. Retain incomplete and contaminated passes, but qualify their use. A pass that read another synthesis contributes zero independent interpretive convergence. An untraceable claim cannot affect final confidence until lineage is repaired.
3. Namespace every local identifier: `P01/CAN-006`, `P02/MS-014`, `P01/OUT-001`. Local IDs and matching prose are not global identity.
4. Normalize atomic propositions and underlying sources. Merge only equivalent claims. Preserve `supports`, `extends`, `narrows`, `qualifies`, `contradicts`, `alternative cause`, and `distinct segment` relationships.
5. Build the reversible chain: final claim → namespaced synthesis claims → raw finding IDs → run-local source IDs → global source fingerprints. Inspect raw reports only to repair or verify missing lineage, material contradictions, or high-impact claims; do not redo layer one or two.
6. Recompute evidence confidence independently of pass agreement. Report interpretive convergence, raw-report independence, source independence, source-class diversity, segment coverage, and challenges as separate dimensions. Never average local confidence labels or use majority rule.
7. Produce every artifact in the final-output template. Every accepted, rejected, split, merged, contradicted, or quarantined synthesis claim must be accounted for.
8. Capture completion time in UTC and save under `final/YYYY-MM-DDTHH-mm-ssZ--<review-id>--<model>/`. Normalize identifiers to lowercase kebab-case; append `--02`, then `--03` on collision. Never overwrite or leave the review only in chat. Return the exact absolute output paths and any persistence limitation.

## Completion gate

- Every frozen synthesis pass and recognized claim is inventoried.
- Every final factual claim traces to raw evidence or is explicitly quarantined.
- Pass convergence is never presented as source corroboration.
- Contamination, missing lineage, contradictions, minority claims, and negative evidence remain visible.
- Counts reconcile and every dedupe decision is reversible.
- Product/design implications distinguish established requirements, contested interpretations, and hypotheses.
- No web evidence, previous final, or post-freeze synthesis silently entered the corpus.

## Anti-patterns

- “Five of six syntheses agree, therefore confidence is strong”
- Treating repeated raw reports or source families as new evidence
- Matching local `CAN-*` or `MS-*` IDs across passes by number
- Silently discarding incomplete, contaminated, minority, or untraceable material
- Reading previous finals before freezing an independent review
- Re-running the original research instead of auditing synthesis behavior
- Producing one polished summary without lineage, accounting, and disagreement artifacts
