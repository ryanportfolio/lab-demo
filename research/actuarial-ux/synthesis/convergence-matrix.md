# Convergence matrix

Counts per protocol §4 — reported separately, not converted into scores. "Blind runs" = of 4 (all runs were blind; RB noted branch-name exposure only). "Unique FPs" = distinct underlying-source fingerprints after dedupe (see [master-source-ledger.md](master-source-ledger.md)); trade-press relays and multi-run re-reads of one fingerprint are excluded. Classes: FP=vendor first-party, PB=professional body, AC=academic, RG=regulatory/standards, VS=vendor survey/case study, VM=vendor marketing, TP=trade press, IA=implementation artifact (jobs/code), UR=user reviews, PF=practitioner forum, BL=practitioner blog.

| CAN | Short name | Runs | Blind runs | Unique FPs | Source classes | Segments covered | Credible challenge? |
|---|---|---|---|---|---|---|---|
| CAN-01 | PL live/shipping | 4/4 | 4 | 1 (FP-PL) | FP only | vendor | None, but single-class |
| CAN-02 | PL AI agents, controls undescribed | 4/4 | 4 | 1 (FP-PL) | FP only | vendor | Absence-in-text ≠ absent controls |
| CAN-03 | PL governance-UX bet (inference) | 4/4 | 4 | 1 (FP-PL) | FP only | vendor | Inference from one source |
| CAN-04 | No independent PL evidence | 4/4 | 4 | n/a (negative) | search absence | — | One-day window; young co. |
| CAN-05 | PL interior uninspectable | 4/4 | 4 | 1 (FP-PL) | FP (observed) | — | None |
| CAN-06 | Spreadsheet substrate | 4/4 | 4 | 6+ (CODY, PRYOR-2006, IFOA-2006, HX-BLOG, HX-AVIVA, KESTER) | PB, AC, VM, VS | pricing+reserving+life, US/UK | 8%-solely-spreadsheets nuance |
| CAN-07 | Social version control | 4/4 | 4 | 3 (CODY, HX-SOP, PROPHET-JOBS) | PB, VS, IA | life+pricing governance | FP-CODY carries the narrative — single-author risk |
| CAN-08 | Latency normalized | 4/4 | 4 | 5 (NESTED-SOA, OW2021, SOA-MP-2020, FARMER-2025, FIS-SCALE) | PB, VS, VM | life-heavy | Some rationing is principled methodology |
| CAN-09 | Majority time operating | 1/4 | 1 | 1 (OW2021) | VS-via-PB | life, 2021 | Staleness |
| CAN-10 | Data-prep dominance | 3/4 | 3 | 4 (MILLIMAN-ARIUS, GIRO-DQ-2008, OW2021, HX-BLOG) | VS, PB | reserving+pricing+life | Magnitudes each weak; some prep is judgment |
| CAN-11 | Deployment re-coding, months | 3/4 | 3 | 5 (EARNIX, WTW-SVY-2026, WTW-RADAR-PR, GUIDEWIRE, FINTECHGLOBAL) | VS, VM, TP | P&C pricing US/UK | **Yes — CAN-22 (G2 praise)**; all sponsors sell remedies |
| CAN-12 | hx dissatisfaction stats | 3/4 | 3 | 1 family (HX-SOP) | VS only | specialty/commercial US/UK | Sponsor bias; magnitudes contested |
| CAN-13 | Buy-in bottleneck | 1/4 | 1 | 1 (HX-SOP) | VS | specialty pricing | Vendor FP; retained outlier |
| CAN-14 | AI fear falling | 1/4 | 1 | 1 (HX-SOP) | VS | UW+actuaries | Vendor narrative interest |
| CAN-15 | Specialist moats | 4/4 | 4 | 4 (PROPHET-JOBS multi-employer, GOACTUARY-1, FIS-SCALE, CODY-adjacent) | IA, PF, VM | life platforms, US | Domain complexity may demand specialists regardless |
| CAN-16 | Open-source counter-movement | 2/4 | 2 | 3 (CHAINLADDER, PRYOR/Gan editorial, CAS-TECH-SVY) | PB, AC, IA(code) | coder-minority segment | >80% time-barrier limits generalization |
| CAN-17 | Organizational root cause | 1/4 | 1 | 1 (ROBIDOUX) | PB article | cross-cutting | Contradiction entry by design |
| CAN-18 | US regulatory traceability | 3/4 | 3 | 4 (CASTF-WP, NAIC-AIB, ASOP56, AKUR8-NAIC) | RG primary+secondary | US | None found |
| CAN-19 | UK regulatory + episodic governance | 1/4 | 1 | 2 (BURNINGCOST→SS1/23+TR24/2, AAA-PN-2017) | BL, PB | UK pricing | Blog authorship unverified; second-hand quotes |
| CAN-20 | Regulator-engagement precedent | 2/4 | 2 | 1 (AKUR8-NAIC) | RG-hosted | US P&C | None |
| CAN-21 | Multi-tool single roles | 1/4 (atomic), 3/4 narrative | 1 | 1 class (jobs, multi-employer) | IA | reserving | Different tools may = different jobs |
| CAN-22 | Incumbent virtues (contested) | 3/4 | 3 | 4 (G2-AXIS, G2-RADARLIVE, WTW-MPI, HX-BLOG concession) | UR, VM | AXIS/Radar users | Thin n; commercial customer stories |
| CAN-23 | Practitioner-voice blackout | 4/4 | 4 | n/a (ACCESS-NEG) | method | — | Access artifact ≠ ecosystem fact |
| CAN-24 | Akur8–Arius consolidation | 2/4 | 2 | 1 (AKUR8-ARIUS-PR) | TP+VM | reserving market | None |
| CAN-25 | PL P&C wedge vs life pain (inference) | 4/4 | 4 | 1 (FP-PL) | FP-derived inference | — | Same-source convergence; no segment statement |

**Reading guidance:** high run-count with 1 fingerprint (CAN-01/02/03/12/25) means the model reasoned alike from one source, not that evidence is plural. The best-evidenced incumbent findings are CAN-06, CAN-08, CAN-15, CAN-18 (4+ fingerprints spanning ≥3 classes).
