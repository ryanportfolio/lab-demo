# Contradiction and outlier register

Competing claims, contexts, and the evidence needed to resolve them. Nothing here was deleted in deduplication.

## Contradictions

### X1 — "Incumbent deployment is slow" vs "Radar Live deployment is fast and painless"
- **Side A (CAN-11):** months-long deployment cycles, IT re-coding, duplicate truths (Earnix, WTW survey, Guidewire, hx — all commercially motivated, 3 runs).
- **Side B (CAN-22):** G2 Radar Live reviewers praise deployment speed and beginner-friendly GUI (RC S15); WTW/MPI customer story calls Radar "user-friendly" (RB S09).
- **Context of disagreement:** pain likely segments by shop, line of business, and tooling generation — Excel-centric/legacy-engine shops vs modern rating-platform adopters. Both sides are commercially entangled.
- **Resolution evidence needed:** release-cycle-time data segmented by tooling generation (neutral survey or telemetry). Directly decision-relevant to whether "faster deployment" is a live wedge or an already-solved problem in target accounts.

### X2 — "Excel/legacy is the problem" vs "Excel is a symptom; closedness is a feature"
- **Side A:** modernizer-vendor convergence on Excel fragility, weak versioning, slow iteration (CAN-06/12; incentive-aligned).
- **Side B (CAN-17):** Robidoux — Excel sprawl stems from the actuary–IT organizational split; replacement tools either relocate shadow IT or inherit the IT bottleneck. **(CAN-22):** AXIS is praised *because* it is closed (consistency across junior teams); hx itself concedes Excel formula transparency aids stakeholder review and regulatory audit.
- **Implication:** a challenger can lose reviewability and consistency while fixing flexibility — replacing Excel can make review *worse* unless diffs/explanations are first-class; org fit (who owns the tool, IT or actuarial) is a live adoption variable.
- **Resolution evidence needed:** usability tests of review/diff surfaces with *reviewers* (not modelers); adoption case studies segmented by IT-ownership model.

### X3 — Dissatisfaction magnitude: 96–99% vs unmeasured reality
- **Side A (CAN-12):** near-total dissatisfaction per hx State of Pricing family.
- **Side B (CAN-23):** the only independent channels that could confirm or refute (forums, reviews) were unreachable or empty; satisfied incumbent users are structurally silent; complaint volume is unmeasured in both directions (anti-pattern guard: absence of complaints ≠ satisfaction, volume ≠ pain).
- **Resolution evidence needed:** professional-body (SOA/CAS/IFoA) satisfaction survey or authenticated forum ethnography.

### X4 — Strongest documented pain (life compute) vs Prediction Lab's apparent wedge (P&C pricing)
- **(CAN-25, inference):** quantified latency/toil evidence concentrates in life valuation (CAN-08/09), a nested-stochastic compute class no PL evidence covers; PL's visible features are GLM/pricing-shaped. The market with the best-documented pain and the product's apparent segment may diverge.
- **Resolution evidence needed:** PL first-party segment statement, demo, or benchmark on life projection workloads.

## Retained outliers (single-run or single-source; kept per protocol §6)

| ID | Finding | Why retained |
|---|---|---|
| CAN-13 | Underwriter/business buy-in blocks model adoption (38% actuaries; 45% of underwriters call models stale) | Exposes a distinct failure mode — cross-role persuasion — directly relevant to any evidence/review product; least self-serving finding inside a vendor survey |
| CAN-14 | AI-replacement fear halved year-over-year | Strategically important unknown for AI-delegation adoption timing; vendor fingerprint flagged |
| CAN-17 | Organizational root-cause counter-narrative | Plausible alternative cause for the whole pain story; changes product/GTM strategy if true |
| CAN-19 | UK SS1/23–TR24/2 governance-evidence gap | Only geographic extension beyond US in the campaign; severe-harm relevance (regulatory findings) |
| CAN-09 | >50% of life team time on operating vs analyzing | Single high-quality fingerprint; quantifies the toil story better than anything else reached |
| FP-GOACTUARY-1 (in CAN-15) | Job offer decided by Prophet experience | The campaign's only direct practitioner-forum voice; minority evidence class |
| RD-F13 / CAN-22 | Closed-system consistency praised | Minority user segment (large junior teams) whose needs a flexibility-first design would harm |

## Negative evidence (failed confirmations)

- No independent Prediction Lab customer/outcome/review evidence, 4/4 runs (CAN-04).
- No reachable literature on how teams remember *failed* experiments in any incumbent (RB §7) — genuinely unstudied in reachable sources, not just unmet.
- No current practitioner complaints specific to Emblem/Radar/ResQ UI were findable — channels dead or blocked (CAN-23); explicitly *not* evidence of satisfaction.
- No evidence PL covers reserving or life valuation (RD §7).
