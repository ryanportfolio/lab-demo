# Actuarial UX review checklist

## Decision continuity

- Can the user name the active model, dataset version, target, exposure, slice, validation plan, baseline, and environment?
- Does changing selection update every linked view without losing context?
- Can a shared link or review reopen the same evidence state?

## Actuarial meaning

- Are measures expressed in insurance terms before generic ML terms?
- Are denominators, exposure, time windows, partitions, and credibility visible where they change interpretation?
- Do metric differences (Gini, lift, A/E) carry the uncertainty that decides whether they are signal (standard error, fold spread, exposure) rather than being graded by an invented pass mark or zero-crossing? Actuarial acceptance criteria are deliberately judgment-based; a small delta below its standard error is noise and must be readable as noise.
- Do diagnostics lead to a decision, not just describe a model?

## Evidence and provenance

- Does each claim point to a real fit, chart, table, source, or diagnostic?
- Are exact values available without an export?
- Are filters, targets, partitions, method, run, and data version attached to the artifact?
- Does an exported or shared artifact reveal its as-of version and whether it has been superseded?
- Could this decision be reconstructed from platform records alone, months later?
- Is the weakest or least credible result prominent?

## Experiments and AI

- Are successful, failed, skipped, and refused experiments all accounted for?
- Is the failure reason reusable memory rather than transient copy?
- Can the user see what the agent read, changed, and concluded?
- Are agent permissions and the human-only gate obvious?

## Review

- Is this exploration, model-candidate review, filing, or deployment, and is every control appropriate to that stage?
- Does review show the material before/after model or dataset diff?
- Could the reviewer sign off without opening the previous version's file?
- If the surface replaces spreadsheet formula review: can formula-auditing stakeholders still trace how a number was computed, and has the replacement been validated with them?
- Are business impact and guardrail outcomes connected to evidence?
- Can the reviewer ask a follow-up without leaving the decision package?
- Does approval record an intentional human judgment about the weak point?

## Interaction quality

- Do clickable chart marks and controls look clickable and meet useful target sizes?
- Does current evidence remain stable while the next artifact loads?
- Are progress, cancel, error, empty, stale, and conflicting-edit states understandable?
- Do desktop and narrow layouts preserve legibility, ordering, and provenance?

## Smell test

If the workflow still depends on copying a model, screenshotting a chart, exporting to Excel, explaining state in chat, or reconstructing evidence during review, the product has not yet absorbed the real job.
