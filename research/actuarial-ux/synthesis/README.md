# Actuarial UX research — aggregation of 4 independent runs

Aggregated 2026-08-07 per `.claude/skills/researching-actuarial-ux/references/aggregation-protocol.md`.

## Input inventory (validation per protocol §1)

All four runs were blind, single-day desk-research passes executed 2026-08-07 by Claude Fable 5 (claude-fable-5) in separate Claude Code worktree sessions. No run had an assigned lens; each self-reported full-problem coverage. Reports were delivered in-response (never committed); they were extracted verbatim from session transcripts into `../runs/` with provenance frontmatter. See each run file's frontmatter for origin branch, worktree, session ID, and delivery timestamp.

| Alias | Run file | Self-assigned run ID | Blindness | Findings | Sources | Source classes reached |
|---|---|---|---|---|---|---|
| **RA** | [run-0e0fbb.md](../runs/run-0e0fbb.md) | R01-20260807 | Blind (self-declared) | 14 (F01–F14) | 25 (S01–S25) | vendor first-party, professional body, regulatory, vendor surveys, trade press, practitioner articles, implementation artifacts, code repos |
| **RB** | [run-709c2f.md](../runs/run-709c2f.md) | ADHOC-20260807/R01 | Blind; notes contamination-adjacent branch-name exposure (no content read) | 17 (F01–F17) | 15 (S01–S14, S16) | vendor first-party, professional body, academic, regulatory/standards, vendor surveys, trade press, implementation artifacts |
| **RC** | [run-80462c.md](../runs/run-80462c.md) | R-20260807-A | Blind (self-declared) | 9 (F01–F09) | 17 (S1–S17) | vendor first-party, professional body, regulatory, vendor surveys/case studies, trade press, user reviews (G2), implementation artifacts |
| **RD** | [run-8de9f1.md](../runs/run-8de9f1.md) | adhoc-2026-08-07/R01 | Blind (self-declared) | 14 (F01–F14) | 16 (S01–S16) | vendor first-party, professional body, regulatory (incl. UK), practitioner blog, one forum post, user reviews (snippet), implementation artifacts |

**Original-ID collision note:** every run self-assigned `R01-Fxx` IDs. Aggregation references use the alias prefix (`RA-F02` = run-0e0fbb finding F01-F02 etc.). Original IDs are preserved unchanged inside the run files.

**Independence caveat (applies to every convergence count):** all four runs are the same model, same day, same tool environment. They share correlated *access* blind spots (Reddit/forums blocked for all four) and repeatedly reached the same underlying sources (Prediction Lab first-party 4/4, Cody SOA Git article 3/4, hyperexponential survey family 3/4). "4/4 blind runs" therefore measures independent *reasoning* convergence, not independent *evidence*. Unique-fingerprint counts in the convergence matrix are the honest evidence measure.

## Artifacts

1. [executive-synthesis.md](executive-synthesis.md) — strongest findings, tensions, unknowns
2. [canonical-findings.md](canonical-findings.md) — CAN-01…CAN-25 with confidence and provenance
3. [convergence-matrix.md](convergence-matrix.md) — per-CAN report/fingerprint/class counts
4. [dedupe-map.md](dedupe-map.md) — all 54 original findings → canonical IDs (reversible)
5. [master-source-ledger.md](master-source-ledger.md) — canonical sources keyed by fingerprint
6. [contradictions-outliers.md](contradictions-outliers.md) — competing claims and retained minority findings
7. [coverage-gaps.md](coverage-gaps.md) — missing products, users, geographies, classes
8. [research-backlog.md](research-backlog.md) — next questions ranked by decision value
9. [design-opportunity-brief.md](design-opportunity-brief.md) — evidence-supported requirements and questions only
