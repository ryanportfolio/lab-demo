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
3. Treat each completed top-level child directory under `synthesis/` as one layer-two pass unless the caller supplies an explicit pass list. Nested `_working/`, `intermediate/`, `data/`, or similarly named directories belong to that parent pass; never count them as separate passes merely because they contain synthesis-shaped files. Freeze and hash every artifact recursively before analysis. Never add a pass or artifact that appears after the freeze.
4. Classify each artifact as `published`, `provenance`, `working`, `temporary`, or `unknown` from content and structure, not filenames alone. Published artifacts define the pass's asserted conclusions. Provenance and working artifacts may repair lineage, validate counts, or explain derivation, but may not silently add claims or evidence. Mark material found only in working state as `working-only`. Quarantine it unless a published artifact adopts it or selective raw-evidence verification establishes it; in the latter case label it `reviewer-derived` and give it zero interpretive convergence.
5. Exclude `final/`, previous layer-three outputs, partial output directories, and raw `runs/` reports from the primary input set. Do not browse the web or introduce new external evidence. If only one valid synthesis exists, perform a pass-quality audit but make no cross-pass convergence claim.
6. Do not read a previous final before the current review is frozen. Read one only when the user explicitly requests a legacy delta audit; it contributes zero evidence and imports nothing without raw lineage.

## Review workflow

1. Inventory every pass and recursively discovered artifact. Assign aliases `P01`, `P02`, and so on by declared completion UTC, falling back to normalized absolute path when time is missing or tied; disclose every fallback. Record parent pass, artifact role, path, hash, date, input-report hashes, blindness, contamination, and missing semantic roles.
2. Record the synthesis-producing agent/model separately from the underlying research-report model families. Never infer the producer from the inputs; use `unknown` when absent.
3. Assess each pass using the protocol's separate quality dimensions and semantic role coverage across both published and nested provenance artifacts. Retain incomplete and contaminated passes, but qualify their use. A pass can be full when reversible lineage lives in nested machine-readable provenance rather than a root-level atomic ledger. A pass that read another synthesis contributes zero independent interpretive convergence. An untraceable claim cannot affect final confidence until lineage is repaired.
4. Namespace every local identifier: `P01/CAN-006`, `P02/MS-014`, `P01/OUT-001`. Local IDs and matching prose are not global identity.
5. Normalize atomic propositions and underlying sources. Merge only equivalent claims. Preserve `supports`, `extends`, `narrows`, `qualifies`, `contradicts`, `alternative cause`, and `distinct segment` relationships.
6. Build the reversible chain: final claim → namespaced published synthesis claims → raw finding IDs → run-local source IDs → global source fingerprints. A selectively verified reviewer-derived claim may link directly to raw findings, but contributes zero interpretive convergence. Use provenance and working artifacts only for accounting or lineage repair, and label every repaired edge. Inspect raw reports only to repair or verify missing lineage, material contradictions, or high-impact claims; do not redo layer one or two.
7. Recompute evidence confidence independently of pass agreement. Report interpretive convergence, raw-report independence, source independence, source-class diversity, segment coverage, and challenges as separate dimensions. Never average local confidence labels or use majority rule.
8. Produce every artifact in the final-output template. Every accepted, rejected, split, merged, contradicted, working-only, or quarantined synthesis claim must be accounted for.
9. Capture completion time in UTC and save under `final/YYYY-MM-DDTHH-mm-ssZ--<review-id>--<model>/`. Normalize identifiers to lowercase kebab-case; append `--02`, then `--03` on collision. Never overwrite or leave the review only in chat. Return the exact absolute output paths and any persistence limitation.

## Completion gate

- Every frozen synthesis pass and recognized claim is inventoried.
- Every recursively discovered artifact has one role and one parent pass; nested work products are never counted as independent passes.
- Every final factual claim traces to raw evidence or is explicitly quarantined.
- No working-only claim silently enters the published claim graph.
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
