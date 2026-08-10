---
name: designing-actuarial-chart-workspaces
description: Use when designing, reviewing, or implementing interactive charts, diagnostics, evidence plots, or chart-centered question answering in an insurance actuarial workflow.
user-invocable: true
---

# Designing actuarial chart workspaces

## Core principle

A chart is a working surface, not a report. It must support **see → isolate → compare → explain → act → preserve** without losing model, data, denominator, or evidence context.

## Frame the decision

Name the user, decision stage, target, denominator, baseline, slice, guardrail, reviewer, and consequence. Never invent statistics, hierarchy, provenance, or actions; name missing dependencies and disable with a reason.

## Six-question contract

Every chart must answer:

1. **Question:** What actuarial question does it answer?
2. **Pattern:** What is legible immediately, including the weak or thin area?
3. **Probe:** What mark, category, or range can the user isolate?
4. **Explanation:** What values, exposure, uncertainty, and provenance appear?
5. **Next question:** What valid comparison, diagnostic, or bounded agent action follows?
6. **Continuity:** Can the state be reopened, shared, cited, and reviewed?

No question means decoration. Any other gap means incomplete work.

## Interaction grammar

Use one linked selection across plot, table, diagnostics, citations, and review.

| Capability | Rule |
|---|---|
| Hover or focus | Preview value, unit, denominator, and delta. Keep critical facts outside hover. |
| Click, tap, or Enter | Pin selection and drive linked evidence. |
| Range selection | Use for ordered continuous, distribution, geography, or time questions, not unrelated categories. |
| Comparison | Allow only when definitions, populations, periods, and denominators match. |
| Exposure and credibility | Put available weight, sparsity, uncertainty, or instability beside estimates. |
| Guardrails | Overlay only real thresholds governing this decision; show distance and breach direction. Filing and stated goal constraints are real; invented model-quality pass marks (a ΔGini or lift zero-crossing, a closeness cutoff) are not. Render standard error, spread, and exposure context instead, and never color a value pass/fail on a bare point estimate. |
| Drill-down | Require a real hierarchy or supported slice. Preserve parent selection and reset. |
| Ask from selection | Send selection, model, data, filters, run, method, and artifact. Show what the agent read; it cannot approve. |
| Preserve | Carry selection, comparison, filters, table state, provenance, and weak point in the link or review. Label local-only state. Exports carry version identity and reveal when superseded. |

Provide keyboard and touch parity, visible focus, useful targets, color-independent meaning, reduced motion, a semantic exact-values table, and a plain-language summary.

## State contract

Support `empty → loading → ready → refreshing | error | stale`. Keep the last valid artifact during refresh. Identify stale or failed context. Never collapse layout or silently mix states.

## Completion gate

Verify six questions, applicable interactions, desktop and narrow layouts, keyboard flow, preservation, exact values, all states, and one adversarial case. A skeptical actuary must find the pattern, weakest point, denominator, source, and next action without reconstructing context.

## Evidence base

Calibrated to meta-review-r04 chart canon (L3-CAN-027..033) as replicated by `final/2026-08-10T19-14-49Z--canon-replication-delta-r01--claude-fable-5/`: the question-shaped canon, companion/exact-value requirements, and export-context-loss mechanism are replicated cross-model; the no-invented-thresholds rule stands, but the concrete uncertainty *encoding* is contested — validate encodings with decision-quality tasks (actuaries AND board-level readers), never preference. In-chart drill-down/write-back has document-grounded reserving precedent only; treat as contested for pricing scope.

## Anti-patterns

- Identical interaction menus on statistically different charts
- Tooltip dumping, permanent control walls, gesture-only or hidden actions
- Zoom, brush, drill-down, AI, or guardrails without a decision-bearing use
- Detached chat; screenshots or exports as the only preservation path
- Visual confidence without available exposure, uncertainty, provenance, or a visible weak point
