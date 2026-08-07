# Meta-synthesis protocol

## Representative layer-two shape

A complete pass may contain an input manifest, executive synthesis, canonical findings, convergence matrix, reversible dedupe map, master source ledger, contradiction/outlier register, coverage gaps, research backlog, design brief, terminology map, and atomic finding ledger. Some roles may live in nested JSON or CSV provenance rather than root Markdown. Future passes may rename, omit, combine, nest, or add artifacts. Detect semantic roles from headings, tables, schemas, and declared accounting as well as filenames.

## Pass and artifact boundaries

- Default pass boundary: one completed top-level directory under `synthesis/`. A caller-supplied explicit list overrides discovery.
- Nested directories such as `_working/`, `intermediate/`, `data/`, `cache/`, or `logs/` belong to their parent pass unless explicitly supplied as passes and independently declared complete.
- Classify every recursively discovered file as `published`, `provenance`, `working`, `temporary`, or `unknown`.
- Published artifacts state the pass's conclusions. Provenance artifacts support reconstruction. Working artifacts expose derivation but are not automatically adopted conclusions. Temporary artifacts and logs provide no claims. Unknown artifacts remain visible until classified.
- Hash all roles. Use provenance and working state to reconcile counts or repair lineage, never as independent evidence or interpretive convergence.
- A working-only proposition may be retained as a quarantined lead. If selective raw-evidence verification establishes it, label it `reviewer-derived`, trace it directly to raw findings and sources, and assign zero interpretive convergence; never attribute it to the layer-two pass.

## Freeze and validate inputs

1. Freeze top-level pass directories, then inventory their artifacts recursively; never promote a nested work directory or individual file into another pass by shape alone.
2. Hash every input artifact, assign its role and parent pass, and assign a pass alias.
3. Order pass aliases by declared completion UTC. When timestamps are missing or tied, use normalized absolute path as the deterministic fallback and record that fallback.
4. Reconcile declared and observed counts: input reports, published atomic findings, working-only findings, canonical findings, source appearances, fingerprints, mapped IDs, outliers, and quarantined material.
5. Detect byte-identical passes, derivative working files, and shared raw-report hashes.
6. Record unknown artifacts; never silently ignore them.

## Producer and input identity

Track these separately:

- synthesis-producing agent/model and generation timestamp;
- underlying raw-report model or researcher families;
- raw-report identities and hashes;
- underlying source fingerprints and families.

Never infer the synthesis producer from the models named in its input manifest. Record `unknown` instead. Interpretive independence depends on the synthesis producer and blindness; research independence depends on raw reports and researcher/model families.

## Pass assessment

Report dimensions separately; do not collapse them into one score:

- input accounting completeness;
- raw-finding and source-lineage reversibility;
- prior-synthesis blindness or contamination;
- evidence/inference separation;
- source-family deduplication;
- contradiction, outlier, and negative-evidence preservation;
- confidence calibration;
- persona, workflow, product, geography, and source-class coverage.

Classify each pass:

- **Full:** manifest, canonical claims, raw/source lineage, dedupe accounting, and contradictions are usable across the complete pass tree. Required lineage may live in nested provenance rather than a root-level atomic ledger.
- **Provenance-capable:** claims trace to raw evidence, but one or more review dimensions are missing.
- **Summary-only:** useful for topic or omission discovery; cannot raise evidence confidence.
- **Quarantined:** claims are circular, invalid, or untraceable; retain with reasons.

## Normalize claims

Compare actor, job/decision, workflow stage, mechanism, consequence, segment, time scope, polarity, and evidence scope. Assign final IDs such as `L3-CAN-001`. One broad synthesis claim may split into several final claims; several local claims may support one final claim.

Allowed relationships:

`equivalent`, `supports`, `extends`, `narrows`, `qualifies`, `contradicts`, `alternative cause`, `distinct segment`, `duplicate text`, `quarantined`.

Only `equivalent` claims merge. Preserve original wording, publication status, artifact role, and exact file/heading/table/JSON locators. Quarantine working-only claims unless published or selectively verified against raw evidence. Keep selectively verified material explicitly reviewer-derived with zero interpretive convergence.

## Normalize evidence

Resolve local source records into global fingerprints using stable document ID, version-sensitive canonical URL, publisher/title/date, then documented semantic matching. Keep survey waves, revised standards, separate customer cases, primary documents, and commentary distinct. Link syndicated or sponsor-family material without counting it as independent. Deduplicate negative evidence by search target, scope, access channel, and date.

## Separate three kinds of convergence

For every final claim report:

1. **Interpretive convergence:** eligible blind synthesis passes detecting the claim.
2. **Research convergence:** unique raw-report hashes and model/researcher families detecting it.
3. **Evidence convergence:** unique underlying sources, independent source families/classes, segments, dates, and credible challenges.

A contaminated pass may reveal an omission or argument but never increments independent interpretive convergence. Pass count never upgrades evidence confidence by itself.

## Evidence confidence

- **Strong:** bounded claim supported by current, direct, relevant authoritative evidence or multiple genuinely independent evidence classes, with material challenges addressed.
- **Moderate:** credible mechanism with limited prevalence, magnitude, segment coverage, or source diversity.
- **Tentative:** vendor-family evidence, selected case, anecdote, inference, dated evidence, or uncertain independence.
- **Contested:** credible comparable evidence supports materially different claims, contexts, or outcomes.
- **Unknown/access-limited:** absence or inspection failure only.
- **Quarantined:** no reversible path to raw evidence.

Keep “the claim is made,” “the condition exists,” “it is prevalent,” “it causes harm,” and “it outranks alternatives” as distinct propositions.

## Adjudication and verification

Preserve minority claims when they expose severe harm, excluded users, a distinct segment, a plausible alternative cause, or a high-value unknown. Use raw reports selectively when synthesis lineages conflict or a decision-critical claim lacks enough detail. If repair fails, quarantine rather than infer. Never browse to patch the corpus; add unresolved needs to the research backlog.

## Accounting gate

Verify:

`recognized synthesis claims = final-cluster members + retained variants + contradictions + working-only quarantines + other quarantined claims`

Every pass-derived final claim must reverse through namespaced published layer-two IDs to raw finding IDs and source fingerprints. Every reviewer-derived final claim must reverse directly to raw findings and source fingerprints and show zero interpretive convergence. Every input pass and recursively discovered artifact must appear in the manifest with its parent and role. Every lineage edge repaired from provenance or working state must be labeled. Explain all count differences.
