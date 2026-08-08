# Actuarial UX wisdom

## The real product problem

Actuarial modeling is not one fit screen. It is a long decision chain across data preparation, assumptions, experiments, diagnostics, business impact, review, filing, deployment, and later explanation. Most friction comes from broken continuity between those stages.

Users can become habituated to workarounds, so absence of complaints is weak evidence. Treat the following as hypotheses to validate through observation, interviews, support history, and product telemetry.

## Observable incumbent friction

- Work is fragmented across modeling software, code, SQL, spreadsheets, email, tickets, slides, and shared drives.
- Batch jobs and slow refits make follow-up questions expensive, suppressing exploration.
- Dense modal configuration, cryptic errors, and hidden defaults make model state hard to audit.
- Generic ML concepts displace insurance semantics such as exposure, frequency, severity, relativities, credibility, lift, calibration, territory impact, and filing constraints.
- Static exports separate a chart from its filter, target, partition, run, and exact values.
- Reviewers receive results but must reconstruct how the result was produced.
- Automation often hides intermediate judgment, weakening trust even when the fit is statistically sound.

## Latent problems

These workarounds reveal unmet needs:

- **Copying as version control:** duplicated files or models preserve safety because history and branching are weak.
- **Screenshots as collaboration:** the product cannot carry an evidence-backed state into discussion.
- **Excel as escape hatch:** exact values, ad hoc comparison, or review formatting are easier outside the product — and formula-visible review is itself valued by audit stakeholders, so the exit is partly a feature.
- **Context evaporation:** target, exposure, filters, partitions, dataset version, and baseline disappear while navigating.
- **Question suppression:** users stop asking useful follow-ups because each rerun or diagnostic is too costly.
- **Reviewer reconstruction:** approval time is spent rebuilding provenance instead of judging the weak point.
- **Failure amnesia:** rejected ideas and their reasons vanish, so teams or agents repeat them.
- **Async ambiguity:** a long fit appears frozen, results arrive without clear ownership, or controls allow conflicting edits.

## Highest-leverage UX opportunities

1. **Persistent active context:** model, data, target, exposure, slice, validation, baseline, branch, and environment remain visible.
2. **Cheap follow-up questions:** every result can lead to a deeper question without manual extraction or hidden state.
3. **Failure memory:** retain refused, invalid, unstable, data-quality, and regulatory failures with reasons and artifacts.
4. **Visual plus exact evidence:** chart for pattern; table for exactness; provenance for trust.
5. **Stable asynchronous state:** plain progress, cancelability, conflict locks, notifications, and no layout collapse while results change.
6. **Actuarial version semantics:** show material model or dataset differences and downstream impact, not commit vocabulary.
7. **Meaningful human review:** material diff, business impact, weakest point, validation, guardrails, unresolved questions, and bounded approval.
8. **Bounded AI delegation:** transparent tools, sources, permissions, refusals, and a human-only decision gate.

## Design stance

- Simplicity means less reconstruction, not fewer capabilities.
- Fewer words are valuable when the visualization carries the comparison.
- Progressive disclosure protects expert control while reducing initial density.
- One accent should carry one meaning, usually current selection.
- Preserve familiar actuarial language and artifacts; modernize the workflow around them.
- Put the weak point beside the win. Trust comes from visible limits, not confident copy.
- A surface that replaces formula-level review is validated with the stakeholders who audit via formulas today; value diffs do not automatically replace logic inspection.
