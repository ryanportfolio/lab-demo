---
name: prediction-lab-actuarial-ux
description: Use when designing, refining, reviewing, or implementing Prediction Lab or insurance actuarial modeling UX, especially AI-agent experiments, evidence, versioning, collaboration, and model review.
user-invocable: true
---

# Prediction Lab actuarial UX

## Core principle

Design a living actuarial working paper, not a generic ML dashboard. Preserve decision continuity from question to experiment to evidence to human review.

## Workflow

1. Read `references/product-context.md` and `references/actuarial-ux-wisdom.md`. Recheck Prediction Lab's official site and changelog when current product state affects the work.
   - If the scope includes a chart, diagnostic, visual evidence, or chart interaction, **REQUIRED SUB-SKILL:** Use `designing-actuarial-chart-workspaces` before design or implementation.
2. Frame the actuarial decision: user, target, exposure, baseline, active slice, guardrails, reviewer, and consequence. Classify the gate as exploration, model-candidate review, filing, or deployment. Apply only governance required at that stage. Label assumptions. Begin design only when the decision and risk are concrete.
3. Map the workflow around four surfaces:

| Surface | Must answer |
|---|---|
| Context register | What model, data, target, slice, and validation plan are active? |
| Experiment ledger | What changed, what failed, and what should not be retried? |
| Evidence | Did the gain hold, where is it weak, and what exact artifact supports it? |
| Decision gate | What materially changes, what stayed bounded, and what needs human judgment? |

4. Keep one linked selection across tables, charts, evidence, and citations. Preserve the current artifact while another loads. Show progress without collapsing layout or hiding state.
5. Lead with visual evidence. Keep exact values, filters, source, run, and method one action away. Make the weakest point as visible as the winning metric.
6. Bound AI delegation. Separate product guidance, context interpretation, and modeling action. Show what the agent read, changed, refused, and cannot approve.
7. Verify with `references/review-checklist.md`, desktop and narrow screenshots, and real interaction states. Report which latent pain each change removes.

## Completion gate

A skeptical pricing actuary can identify the active context, material change, supporting evidence, weakest point, guardrail status, provenance, and human decision without reconstructing the run elsewhere.

## Anti-patterns

- Generic ML metrics or training-job metaphors when actuarial measures exist
- Chat-first UI, card soup, Git cosplay, or logs presented as explanation
- Simplification that removes expert control or hides assumptions
- Approval screens that merely repeat results or become compliance checklists
- Deployment, filing, fairness, or rollout controls invented inside an earlier model-candidate review
- Green status without failure memory, exact evidence, and the weak point
- Copy, screenshots, exports, or Excel as the only way to preserve context
