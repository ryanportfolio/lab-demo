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
2. Establish the campaign directory before research. Use a caller-supplied shared path when present. Otherwise resolve the actual user's Desktop directory at runtime and use `RESEARCH-LAB/<campaign-id>/`; never hardcode a username or OS-specific Desktop path. Default the campaign ID to `prediction-lab-actuarial-ux`. If a sandbox or permission boundary protects this existing folder, request narrowly scoped write approval when the runtime supports it; do not choose the repository fallback merely to avoid approval. Only when Desktop or `RESEARCH-LAB` is unavailable, approval is denied, or writing remains impossible, use `research/actuarial-ux/<campaign-id>/` and disclose that separate worktrees may not share uncommitted files. Never default to a temporary directory or a chat-only report.
3. Choose a unique run ID and model slug without opening existing reports. Normalize both to lowercase kebab-case. Record the campaign directory in run metadata.
4. Preserve blindness. Do not read earlier reports, summaries, dedupe outputs, the findings inside `prediction-lab-actuarial-ux`, or another researcher's working notes. A campaign manifest containing only assignments and run metadata is allowed. If contamination already occurred, disclose it and label the pass non-blind.
5. Browse current sources. Verify Prediction Lab through first-party pages, changelogs, talks, demonstrations, or documentation. Investigate incumbent products and surrounding workflows through practitioner evidence, manuals, training/support material, professional or regulatory sources, implementation artifacts, and direct product inspection where available. Treat vendor marketing as a vendor claim, not proof.
6. Build the source ledger before synthesis. Record canonical URL, publisher, date, access date, source class, product/version context, useful evidence, limitations, and the underlying-source fingerprint.
7. Extract atomic findings. Separate direct observation, practitioner report, vendor claim, inference, hypothesis, contradiction, and negative evidence. Connect every factual claim to source IDs; label unsourced interpretation.
8. After the report is complete, capture completion time in UTC and write it under `<campaign-directory>/runs/` as `YYYY-MM-DDTHH-mm-ssZ--<run-id>--<model>.md`. Example: `2026-08-07T18-21-04Z--run-07--claude-opus-4-1.md`. If that exact filename exists, append `--02`, then `--03`; never overwrite. Record the ISO completion time and exact absolute path in the report. Return the path and persistence limitation, if any. The response may summarize the report, but does not replace the saved artifact. If no durable location can be written, say so explicitly and return a copy-ready filename and report; never imply a future session can discover chat history.
9. Stop only after the research questions and source classes have meaningful coverage, or further searching yields no new strong evidence. Disclose unreachable evidence and scope gaps.

## Aggregation

Read `references/aggregation-protocol.md` and `references/report-template.md` completely. Use the caller-supplied campaign directory, or resolve the same Desktop/repository default used by independent runs, including scoped approval behavior. Ingest every report under `<campaign-directory>/runs/` before ranking. Normalize atomic claims, fingerprint shared sources, preserve provenance, map every merge, and retain material contradictions and outliers. Do not use report count as evidence strength when reports repeat the same source. Save aggregation artifacts under `<campaign-directory>/synthesis/YYYY-MM-DDTHH-mm-ssZ/` and return the exact absolute paths.

## Completion gate

- Current Prediction Lab claims are dated and sourced.
- Major findings distinguish evidence from inference.
- Source diversity and missing source classes are visible.
- Independent runs remain blind to previous conclusions.
- Aggregation is reversible through finding, source, and dedupe maps.
- Design implications remain questions or requirements until evidence supports a solution.
- Every run and synthesis is a durable file with its exact path reported to the user.

## Anti-patterns

- Generic “legacy software is ugly” conclusions without workflow evidence
- Landing-page comparison presented as user research
- Complaint volume treated as absence or presence of pain
- Quotes or screenshots detached from product version and context
- Multiple reports citing one source counted as independent corroboration
- Deduplication that deletes disagreement, minority users, or severe edge cases
- Recommendations mixed into observations so later researchers cannot re-evaluate them
- Reports left only in chat, temporary folders, or undisclosed worktrees
