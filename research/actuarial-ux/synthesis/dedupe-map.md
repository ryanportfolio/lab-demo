# Dedupe map — every original finding → canonical ID

Reversible per protocol: each row records the merge target and relationship. Aliases: RA=run-0e0fbb, RB=run-709c2f, RC=run-80462c, RD=run-8de9f1 (original in-file IDs are all `R01-Fxx`; prefix disambiguates). Relationship labels: `duplicate` (materially same actor/mechanism/consequence), `supports`, `extends`, `narrows`, `contradicts`, `retained outlier`.

| Original | Canonical | Relationship | Merge rationale |
|---|---|---|---|
| RA-F01 | CAN-06 | duplicate | Spreadsheet centrality, hybrid-stack caveat carried into CAN text |
| RA-F02 | CAN-07 | duplicate | Filename/changelog-tab versioning (FP-CODY) |
| RA-F03 | CAN-12 | duplicate | 47%/96% audit-difficulty stats, hx fingerprint |
| RA-F04 | CAN-12 | extends | Week+/month model fill-in time — same hx fingerprint, distinct sub-claim kept in CAN text |
| RA-F05 | CAN-11 | duplicate | 4-month median deployment, IT bottleneck |
| RA-F06 | CAN-08 | duplicate | Nested-stochastic latency, scope reshaping |
| RA-F07 | CAN-08 | extends | Hand-optimization craft as workaround evidence |
| RA-F08 | CAN-15 | duplicate | Prophet-modeler FSA roles, key-person risk |
| RA-F09 | CAN-16 | duplicate | Open-source motive evidence |
| RA-F10 | CAN-17 | retained outlier (contradiction) | Organizational root-cause counter-narrative; sole member |
| RA-F11 | CAN-18 | duplicate | NAIC bulletin, CASTF, exam pilot |
| RA-F12 | CAN-01 | duplicate | PL live/shipping baseline |
| RA-F13 | CAN-04 | duplicate | Negative evidence: no PL customers |
| RA-F14 | CAN-23 | duplicate | Forum blackout / channel scarcity |
| RB-F01 | CAN-01 | duplicate | PL positioning + speed claim |
| RB-F02 | CAN-03 | duplicate | Release-arc observation; also supports CAN-01 cadence |
| RB-F03 | CAN-02 | duplicate | AI agents + MCP shipped; behavior unverified |
| RB-F04 | CAN-04 | duplicate | Negative evidence: no PL customers |
| RB-F05 | CAN-05 | duplicate | Login-gated interior |
| RB-F06 | CAN-06 | duplicate | Excel substrate (Pryor 2006 + Cody 2026) |
| RB-F07 | CAN-07 | duplicate | Social version authority (FP-CODY) |
| RB-F08 | CAN-09 | duplicate | Sole member; >50% time operating (FP-OW2021) |
| RB-F09 | CAN-08 | duplicate | ~88% scenario cuts, 90% grid/cloud consideration |
| RB-F10 | CAN-10 | duplicate | Manual multi-system data prep (FP-OW2021) |
| RB-F11 | CAN-12 + CAN-13 | split | Dissatisfaction magnitudes → CAN-12; buy-in barrier sub-claim → CAN-13 (retained outlier) |
| RB-F12 | CAN-14 | retained outlier | AI-fear trend; vendor fingerprint, sole member |
| RB-F13 | CAN-18 | duplicate | ASOP 56 duty |
| RB-F14 | CAN-15 | duplicate | Prophet-specialist labor market |
| RB-F15 | CAN-24 | duplicate | Akur8–Arius consolidation; sole press member |
| RB-F16 | CAN-06 | supports | 1.5M-cell anecdote (vendor, snippet-only) |
| RB-F17 | CAN-16 | extends | Academic open-source trajectory |
| RC-F01 | CAN-07 | duplicate | Filename versioning (FP-CODY) + hx corroboration |
| RC-F02 | CAN-10 | duplicate | 800 h/quarter roll-forward (FP-MILLIMAN-ARIUS) |
| RC-F03 | CAN-08 | duplicate | Simplify-to-meet-reporting-schedule (SOA Modeling Platform) |
| RC-F04 | CAN-11 | duplicate | IT re-coding, duplicate truths, 150/192-day cycles; carries G2 challenge → CAN-22 |
| RC-F05 | CAN-12 | duplicate | 56/83/19% stats (FP-HX-SOP, 2023 edition) |
| RC-F06 | CAN-15 | duplicate; extends CAN-07 | Specialist roles; AXIS posting's "versioning methodology" duty independently corroborates CAN-07 |
| RC-F07 | CAN-02 | extends | Absence of stated approval checkpoints in visible text |
| RC-F08 | CAN-20 | duplicate; supports CAN-18 | Akur8/NAIC review + exam-tool pilot |
| RC-F09 | CAN-18 | duplicate | ASOP 56 individual obligation |
| RD-F01 | CAN-01 | duplicate | PL live/cadence |
| RD-F02 | CAN-02 | duplicate | Agents + Q&A shipped; trust properties unverified |
| RD-F03 | CAN-03 | duplicate | Review/governance UX investment |
| RD-F04 | CAN-04 | duplicate | Negative evidence: no PL outcomes |
| RD-F05 | CAN-21 | duplicate | Sole atomic member; multi-tool single-role postings |
| RD-F06 | CAN-10 | duplicate | ~25% time on data quality (FP-GIRO-DQ-2008) |
| RD-F07 | CAN-06 | supports | Aviva 20–30 min anecdote (FP-HX-AVIVA) |
| RD-F08 | CAN-19 | retained (single-run geographic extension) | UK SS1/23 + TR24/2 evidence gap; sole member |
| RD-F09 | CAN-11 | duplicate | WTW "minutes vs months" negative-space baseline |
| RD-F10 | CAN-08 | duplicate | Overnight runs normalized as selling point |
| RD-F11 | CAN-15 | duplicate | Specialist roles + forum hiring anecdote |
| RD-F12 | CAN-23 | extends | Vendor-messaging convergence ≠ corroboration |
| RD-F13 | CAN-22 | retained outlier (contradiction) | Closed-system consistency value |
| RD-F14 | CAN-20 | duplicate | Akur8/NAIC precedent |

**Completeness check:** RA 14/14, RB 17/17, RC 9/9, RD 14/14 → 54/54 findings mapped. No finding deleted; splits and multi-relationships recorded above. Narrative-only evidence (workflow maps, §3 blocks without atomic IDs) is credited in each CAN's "Members" line in [canonical-findings.md](canonical-findings.md).
