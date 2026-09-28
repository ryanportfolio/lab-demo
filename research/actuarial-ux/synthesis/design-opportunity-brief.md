# Design opportunity brief

Per protocol §7.9: only evidence-supported requirements or questions. Anything speculative is labeled. Confidence tags refer to the backing canonical finding.

## Evidence-supported requirements

**R1 — Version identity must be automatic, diffable, and survive round-trips.** (CAN-07 strong, CAN-18 strong)
Who/when/why capture as a byproduct of work, not a filing ritual. Open design question with direct evidence backing: what must a model-change diff show for a reviewer to sign off *without opening the old version*? (RA/RC design questions; PL's own v1.30–v1.35 shipping suggests the vendor is iterating here too.) Constraint: version identity must survive export into the Excel/PowerPoint surfaces where committee work actually happens — unvalidated but flagged by two runs.

**R2 — AI-agent actions must be loggable, attributable, reviewable, and explainable to a market-conduct examiner.** (CAN-02 + CAN-18/19/20 strong)
This is a hard adoption gate, not polish: ASOP 56 makes model understanding an individual professional duty; NAIC AIS programs demand third-party-AI oversight; FCA already calls existing monitoring substance-free. An agent whose experiments cannot be honestly signed is unadoptable by the signing actuary regardless of quality. Design question: what does an auditor-facing trace of an agent-run experiment look like?

**R3 — Review evidence must be legible to non-modelers.** (CAN-13 tentative but strategically load-bearing; CAN-22 contested)
Underwriter/business buy-in blocks deployment of finished models; formula-transparent Excel is what stakeholders currently audit. Requirement: diffs/explanations as first-class reviewer surfaces — validated with reviewers, not modelers — or the replacement *reduces* reviewability (X2 risk).

**R4 — Compressed cycles need trustworthy, reviewable automation of roll-forward/prep.** (CAN-10 strong-direction)
Reserving roll-forward and data prep dominate the front of the cycle. Design question: can "roll forward to new period" be a one-action, diffable operation whose output a reviewer can trust without re-performing the reconciliation ritual?

**R5 — Fast iteration is valuable only where the compute class fits.** (CAN-08 strong, CAN-25 inference)
"Seconds" claims map to GLM/pricing workloads; life nested-stochastic latency may be physics. Do not generalize speed promises across segments without benchmark evidence. Open question: which actuarial workloads actually fit the compute model?

**R6 — Preserve what incumbents do well: consistency and control.** (CAN-22 contested, CAN-17 moderate)
Closed-system consistency across junior teams is praised value, not legacy debt. Flexibility features need guardrails (locked-down modes, governed templates — *speculative label: these specific mechanisms are proposals, not evidence*). Org-fit risk: a tool that bypasses IT re-creates shadow IT; one that requires IT inherits the bottleneck.

## Evidence-supported opportunity spaces (questions, not solutions)

- **Exploration memory:** no reachable evidence that any tool preserves failed experiments and the "why" behind final models — genuinely unstudied (RB §7). Is this a differentiator or a non-need? Requires interviews first.
- **Foregone-fidelity records:** simplify-to-meet-deadline currently leaves no record of what fidelity was sacrificed (CAN-08). Would a recorded, reviewable simplification trail have governance value under SS1/23-style monitoring?
- **Specialist-moat bypass:** can a generalist actuary self-serve what currently requires a $200k platform specialist (CAN-15)? Validation: onboarding-time comparisons.
- **Evidence-to-filing continuity:** the committee/filing evidence path is the biggest observational blind spot (backlog #1) — design work here is premature until observed.

## What the evidence does NOT support (guardrails)

- Building on the assumption that 96–99% of practitioners hate their tools (CAN-12 contested; CAN-23).
- Treating deployment latency as universal (X1 — segments by tooling generation).
- Treating Excel replacement as self-evidently good for review (X2).
- Any claim about Prediction Lab's real-world performance, customers, or agent behavior (CAN-04/05).
