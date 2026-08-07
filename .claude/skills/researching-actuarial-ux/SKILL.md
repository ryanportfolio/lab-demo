---
name: researching-actuarial-ux
description: Use when independently researching Prediction Lab, incumbent insurance actuarial modeling software, legacy pricing workflows, practitioner friction, workarounds, latent UX problems, or when synthesizing multiple independent research passes.
---

# Researching actuarial UX

## Core principle

Keep discovery and synthesis separate. Blind researchers investigate the problem from current sources; aggregators reconcile completed reports. Prior conclusions must not shape an independent pass.

## Choose a mode

- **Independent run** is the default.
- **Aggregation** applies only when the user explicitly asks to combine, deduplicate, compare, or synthesize completed reports.

## Independent run

1. Read `references/research-brief.md` and `references/report-template.md` completely.
2. Preserve blindness. Do not read earlier reports, summaries, dedupe outputs, the findings inside `prediction-lab-actuarial-ux`, or another researcher's working notes. A campaign manifest containing only assignments and run metadata is allowed. If contamination already occurred, disclose it and label the pass non-blind.
3. Browse current sources. Verify Prediction Lab through first-party pages, changelogs, talks, demonstrations, or documentation. Investigate incumbent products and surrounding workflows through practitioner evidence, manuals, training/support material, professional or regulatory sources, implementation artifacts, and direct product inspection where available. Treat vendor marketing as a vendor claim, not proof.
4. Build the source ledger before synthesis. Record canonical URL, publisher, date, access date, source class, product/version context, useful evidence, limitations, and the underlying-source fingerprint.
5. Extract atomic findings. Separate direct observation, practitioner report, vendor claim, inference, hypothesis, contradiction, and negative evidence. Connect every factual claim to source IDs; label unsourced interpretation.
6. Produce the complete report structure. If the caller supplies an output directory, write one uniquely named file using the campaign and run IDs. Otherwise return the full report in the response. Never overwrite another run.
7. Stop only after the research questions and source classes have meaningful coverage, or further searching yields no new strong evidence. Disclose unreachable evidence and scope gaps.

## Aggregation

Read `references/aggregation-protocol.md` and `references/report-template.md` completely. Ingest every supplied report before ranking. Normalize atomic claims, fingerprint shared sources, preserve provenance, map every merge, and retain material contradictions and outliers. Do not use report count as evidence strength when reports repeat the same source.

## Completion gate

- Current Prediction Lab claims are dated and sourced.
- Major findings distinguish evidence from inference.
- Source diversity and missing source classes are visible.
- Independent runs remain blind to previous conclusions.
- Aggregation is reversible through finding, source, and dedupe maps.
- Design implications remain questions or requirements until evidence supports a solution.

## Anti-patterns

- Generic “legacy software is ugly” conclusions without workflow evidence
- Landing-page comparison presented as user research
- Complaint volume treated as absence or presence of pain
- Quotes or screenshots detached from product version and context
- Multiple reports citing one source counted as independent corroboration
- Deduplication that deletes disagreement, minority users, or severe edge cases
- Recommendations mixed into observations so later researchers cannot re-evaluate them
