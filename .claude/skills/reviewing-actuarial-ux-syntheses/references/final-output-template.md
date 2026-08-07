# Final knowledge-base output

Create one self-contained output directory with these artifacts. Adapt prose length, not accounting or lineage requirements.

## Required files

### `README.md`

- completion time, review ID, model, exact output path;
- frozen input boundary and excluded directories;
- pass/artifact inventory with hashes;
- artifact guide;
- accounting totals and unresolved validation failures;
- statement that no new web evidence or previous final entered the primary corpus.

### `00-final-executive-synthesis.md`

- strongest established findings;
- decisive tensions and segment differences;
- what changed across synthesis interpretations;
- highest-consequence unknowns;
- confidence summary grounded in raw evidence, not pass votes.

### `01-synthesis-pass-inventory.md`

For every pass: alias, path, date/model, artifact roles, raw-report hashes, blindness/contamination, quality dimensions, completeness class, missing lineage, and permitted use.

### `02-final-canonical-findings.md`

For each `L3-CAN-*`: bounded claim, actor/workflow/segment, mechanism, consequence, evidence confidence, interpretive/research/evidence convergence, supporting and challenging pass IDs, global source fingerprints, lineage, Prediction Lab relevance, design requirement/question, and validation need.

### `03-meta-convergence-matrix.md`

Keep separate columns for eligible synthesis passes, contaminated passes, unique raw reports, researcher/model families, underlying sources, source families/classes, segments, challenges, stability class, and evidence confidence.

### `04-cross-synthesis-dedupe-lineage.md`

Map every namespaced layer-two canonical/outlier ID to a final claim, retained variant, contradiction, or quarantine reason. Include relationship and merge/split rationale. Preserve one-to-many mappings.

### `05-unified-source-evidence-audit.md`

Global source fingerprints, all local source IDs, raw-report appearances, sponsor/syndication families, directness, version/date, bias and access limits, supported/challenged final claims, and unresolved identity matches.

### `06-disagreement-adjudication-register.md`

Material contradictions, minority interpretations, alternative causes, segment splits, local confidence disagreements, adjudication rationale, remaining uncertainty, and evidence needed to resolve each item.

### `07-omissions-coverage-negative-evidence.md`

Claims found or missed by each pass, unique contributions, missing personas/products/geographies/stages/source classes, search-bounded negative evidence, access limitations, and possible synthesis blind spots.

### `08-final-design-opportunity-brief.md`

Separate established requirements, contested requirements, and speculative opportunities. For each include supported user/job, evidence chain, consequence, constraints, questions the interface must answer, and validation method. Do not turn feature repetition into product truth.

### `09-research-backlog.md`

Rank unresolved questions by decision value and uncertainty. Name the best next method: workflow observation, artifact review, practitioner interview, product inspection, support analysis, telemetry, usability test, benchmark, or additional blind research.

### `10-qa-accounting-report.md`

Reconcile every pass, artifact, synthesis claim, raw finding, and source appearance. List unmapped, duplicated, repaired, excluded, and quarantined records. State whether the completion gate passed.

## Required machine-readable crosswalks

Create `data/pass-manifest.csv`, `data/claim-map.csv`, and `data/source-map.csv`. Use stable IDs and exact paths/locators so another reviewer can reproduce every human-readable artifact without guessing.

## Storage

Default root: resolved Desktop `RESEARCH-LAB/prediction-lab-actuarial-ux/final/`.

Directory format: `YYYY-MM-DDTHH-mm-ssZ--<review-id>--<model>/`.

If the exact directory exists, append `--02`, then `--03`. Never overwrite. Return the exact absolute directory and file paths. If Desktop permission is denied, disclose the repository fallback and cross-worktree limitation.
