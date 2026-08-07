# Canonical findings

Confidence rubric per aggregation protocol §5. Convergence counts in [convergence-matrix.md](convergence-matrix.md); full membership in [dedupe-map.md](dedupe-map.md). Source fingerprints in [master-source-ledger.md](master-source-ledger.md).

## Prediction Lab current state

### CAN-01 — Prediction Lab is a live, actively shipped enterprise insurance-modeling SaaS
**Claim:** Prediction Lab (predictionlab.ai) ships weekly-to-biweekly (v1.19.0, 2026-02-13 → v1.35.0, 2026-07-16), positioned as full-lifecycle "predictive modeling for insurance" with speed as the lead claim ("multi-million record models in seconds"), data connectors (BigQuery, Snowflake, S3, PostgreSQL, Azure, Google Sheets), external enrichment (US Census, NOAA), enterprise posture (single-tenant v1.19, BYOC v1.20, SOC 2 Type II v1.23), and a small remote US team hiring an Actuarial Engineer among five engineering roles.
**Evidence:** observation of first-party pages/changelog by all 4 runs, all accessed 2026-08-07. Single source class (FP-PL fingerprint).
**Confidence:** strong for existence, cadence, and what is *claimed*; performance and "pays for itself within the first model cycle" remain unverified vendor claims (see CAN-04).
**Members:** RA-F12, RB-F01, RB-F02(supports), RD-F01; RC §3 narrative (no atomic ID).

### CAN-02 — Prediction Lab shipped AI modeling agents; human-approval checkpoints are not publicly described
**Claim:** AI agents that "can run the full modeling workflow" shipped v1.30.0 (2026-06-10); MCP-based assistant integration v1.29.0 (2026-05-30); generative model Q&A; marketed as "full transparency and control." Visible first-party text does not describe where human approval, permissioning, refusal, or per-action audit of agent activity sits — an absence-in-visible-text (docs and app are unreachable, CAN-05), not proof controls are absent.
**Confidence:** strong on the shipped claim; tentative on actual behavior.
**Consequence:** central adoption risk — under ASOP 56 and NAIC AIS-program expectations (CAN-18) agent output an actuary cannot attribute, review, and explain is professionally unsignable.
**Members:** RB-F03, RC-F07, RD-F02; RA §3 (narrative).

### CAN-03 — Prediction Lab is deliberately investing in review/governance UX; sequencing implies an enterprise-procurement-first strategy *(inference)*
**Claim (observation part):** dataset review diffs (v1.30.0), model-fit comparison with coefficient deltas inside review (v1.31.0), exact distribution tables beside charts (v1.32.0), richer side-by-side review diffs and before/after edit diffs (v1.35.0), activity feed with deletion tracking, destructive-action confirmation.
**Claim (inference part, labeled):** the arc — deployment/compliance first (v1.19–v1.23), then editing/geo, then review/diffs/AI — reads as procurement-gate clearing followed by a direct attack on the audit/reproducibility gap (CAN-07/CAN-18). All 4 runs drew this inference independently, but from the same changelog, so convergence adds no evidence weight.
**Confidence:** strong for the shipped features; inference for the strategy reading.
**Members:** RD-F03, RB-F02; RA/RC §3 inference blocks.

### CAN-04 — No independent evidence of any Prediction Lab customer, outcome, or review exists *(negative evidence)*
**Claim:** 4/4 blind runs searched and found no named customers, case studies, funding announcements, third-party reviews, or forum mentions. "Leading insurers" on the homepage is undated and generic.
**Confidence:** strong as absence-after-search on one day (young company + gated app plausibly explain it); every capability claim in CAN-01–03 therefore rests on vendor sources alone.
**Members:** RA-F13, RB-F04, RD-F04; RC §3 narrative.

### CAN-05 — Prediction Lab's product interior is uninspectable from outside
**Claim:** app login-gated behind WorkOS AuthKit; trust.predictionlab.ai returned 403 to two runs; no public docs/manual indexed. UX claims cannot be verified; a source class is structurally missing.
**Confidence:** strong (directly observed by all runs that tried).
**Members:** RB-F05; RA §3/S04, RC §3, RD §3 (narrative).

### CAN-25 — Prediction Lab's visible depth is P&C-pricing-shaped while the best-documented compute pain is life-side *(inference; strategic tension)*
**Claim:** feature mix (GLM-adjacent diagnostics: Lorenz/Gini, coefficient deltas, feature contribution; geographic rating visuals) suggests a P&C pricing wedge. The strongest quantified latency pain in reachable literature (CAN-08/CAN-09) sits in life valuation/projection — a different computation class (nested stochastic) that no PL evidence covers. The product's apparent wedge and the loudest documented pain may not be the same market.
**Confidence:** tentative — inference drawn 4/4 from one shared source (changelog); no first-party statement of segment focus.
**Members:** §3 inference blocks of all four runs; RB §7 records it as a tension.

## Incumbent workflow findings

### CAN-06 — Spreadsheets remain the substrate of actuarial practice and degrade at scale
**Claim:** Excel persists as core production infrastructure across pricing, reserving, and reporting (98% of GI actuaries in the 2006 GIRO-era survey; still described as the norm in 2026 professional articles), in *hybrid* stacks — hyperexponential's own survey has only 8% relying solely on spreadsheets. Scale failures are concrete: 1.5M populated cells/65k formulas in one pricing model; 20–30 minutes to open rating tools at Aviva pre-migration (both vendor anecdotes).
**Confidence:** strong for persistence (multi-class, multi-decade corroboration); tentative for the scale anecdotes (vendor fingerprints).
**Members:** RA-F01, RB-F06, RB-F16(supports), RD-F07(supports); RC workflow map.

### CAN-07 — Model version identity is managed socially, not technically
**Claim:** file naming ("Model_Final_v23.xlsm"), Excel changelog tabs, shared drives, and email chains carry version authority; no who/when/why trail; uncertainty about which version is authoritative; Git named as remedy but blocked by CLI learning curve and binary/proprietary model formats. Corroborated from an independent artifact class: an AXIS job posting assigns the hire to "develop and improve existing control and versioning methodology" — versioning as a human job duty.
**Consequence:** irreproducible historical results, overwritten work, audit scramble exactly as regulatory traceability demands rise (CAN-18/19).
**Confidence:** strong — but note the primary narrative source is one practitioner article (FP-CODY, Edward Cody FSA, SOA 2026-02-18) reached independently by 3/4 runs; corroboration comes from the hx audit-difficulty stat (vendor) and the job-posting artifact class.
**Members:** RA-F02, RB-F07, RC-F01, RC-F06(extends); RD workflow map.

### CAN-08 — Compute latency is structural and *normalized*; fidelity is traded for the calendar
**Claim:** life/annuity modeling latency is engineered around, not solved: overnight grid runs are a vendor *selling point* ("50,000 scenarios by tomorrow morning"); stochastic scenario sets cut ~88% (typically to ~1,000) to finish runs; documented "modeling simplifications in order to meet reporting schedules"; a decade of SOA nested-stochastic runtime research; senior FSAs publish loop-bound/table-read optimization craft (85% iteration cuts) with a warning to test that optimizations don't alter results.
**Consequence:** fewer sensitivities explored, silent accuracy loss with no record of foregone fidelity, expensive expert time spent on plumbing.
**Confidence:** strong (existence/persistence; 4/4 runs, 5+ distinct fingerprints across professional-body, consultancy-survey, and vendor classes); moderate for magnitudes.
**Members:** RA-F06, RA-F07(extends), RB-F09, RC-F03, RD-F10.

### CAN-09 — Life modeling teams spend the majority of time operating models rather than analyzing them
**Claim:** over half of surveyed life modeling teams spend more time running processes and preparing results than reviewing/analyzing them (Oliver Wyman survey of 40+ companies, published via SOA 2021-11-17); 90% had considered grid/cloud compute.
**Confidence:** moderate-strong — high-quality single fingerprint (FP-OW2021); 2021 staleness risk.
**Members:** RB-F08.

### CAN-10 — Pre-analysis data preparation dominates the front of every workflow
**Claim:** reserving roll-forward ritual ≈800 h/quarter at one large insurer (≈2 days/analyst checking links before analysis starts); ~25% of actuarial time on data-quality issues (GIRO working party, 2008); ~70% of time on data manipulation (hx, vendor); manual multi-system extracts precede all modeling.
**Confidence:** strong for direction (4 distinct fingerprints across vendor case study, professional body, vendor survey, consultancy survey); tentative for each magnitude individually (best number is a vendor case study; the neutral number is from 2008).
**Members:** RC-F02, RD-F06, RB-F10; RA workflow map.

### CAN-11 — Deployment is a manual re-coding handoff producing duplicate truths and months-long cycles
**Claim:** finished pricing models are manually rebuilt by IT into rating engines; parallel versions of truth (Excel, filing, production); median ~4 months for a significant rate change (no surveyed insurer under 1 month), 150-day (UK)/192-day (US) new-model release cycles, 58% >5 months for rule changes; IT bottleneck named as cause.
**Confidence:** moderate — direction converges across multiple *competing* vendor sponsors (Earnix, WTW, Guidewire, hx) which raises credibility, but all sources are commercially motivated, and a direct contradiction exists: G2 Radar Live reviewers call deployment "fast and painless" (CAN-22). Pain likely segments by tooling generation and shop.
**Members:** RA-F05, RC-F04, RD-F09.

### CAN-12 — Headline dissatisfaction statistics all trace to one vendor's survey family *(contested magnitudes)*
**Claim:** the loudest numbers — 96–99% "pricing tech needs improvement," 47% "difficult to audit/report from," 56% "platforms under-delivered," 48% cite Excel limitations, ~half need a week+ (20% a month) to build/fill a pricing model — originate in hyperexponential's State of Pricing surveys (Coleman Parkes fieldwork, n≈350 specialty/commercial UW+actuaries, US/UK, 2023–2025 editions). Same sponsor, same instrument family, sample skewed to specialty/London market; sponsor sells the replacement.
**Confidence:** contested for magnitudes; moderate for direction only where independently echoed (CAN-07, CAN-11).
**Members:** RA-F03, RA-F04, RB-F11(part), RC-F05.

### CAN-15 — Incumbent platforms create a specialist labor market and key-person dependence
**Claim:** dedicated senior roles exist solely to operate one vendor platform ("Senior Actuary (FSA) – Prophet Modeler," $163k–$200k; "Prophet Specialist"; "AXIS modeling actuary"); one practitioner reports losing a job offer to a candidate with "more Prophet experience"; FIS claims 9,000–10,000 Prophet users across 730–1,000 sites. Switching cost is people, not licenses.
**Confidence:** strong — 4/4 runs, independent employers' postings (implementation-artifact class) plus one direct forum voice plus vendor scale stats.
**Members:** RA-F08, RB-F14, RC-F06, RD-F11.

### CAN-21 — Single roles span many tools; lineage breaks at every boundary
**Claim:** one reserving role routinely requires ResQ/Arius + advanced Excel + SQL + R/Python; multi-tool chains force manual reconciliation and rebuilt spreadsheets each close.
**Confidence:** strong (multiple employers' postings, direct artifact class).
**Members:** RD-F05; RA/RB workflow maps.

### CAN-16 — An open-source counter-movement exists, driven by transparency/reproducibility/lock-in complaints — but serves a coder minority *(distinct segment)*
**Claim:** chainladder-python (CAS-hosted), lifelib, modelx, ChainLadder-R built and adopted explicitly against "outdated softwares," citing transparency, reproducibility, vendor independence; academic trajectory (Annals of Actuarial Science 2026 editorial) points to AI + HPC + open source. Tension: >80% of CAS tech-survey respondents cite lack of time as the biggest barrier to learning new tech — the coding path does not generalize to the median actuary.
**Confidence:** strong for existence and motive; the segment split is load-bearing.
**Members:** RA-F09, RB-F17(extends).

### CAN-24 — Incumbent consolidation: Akur8 acquired/distributes Arius (announced 2024-09)
**Claim:** modern challengers are assembling suites; a point-tool challenger faces suite pressure.
**Confidence:** moderate (press fingerprint + product pages, 2 runs).
**Members:** RB-F15; RC S12(supports).

## Regulatory findings

### CAN-18 — US regulatory demand for model traceability is rising and now covers AI-assisted modeling
**Claim:** CASTF GLM filing "information elements" and model-review manual; NAIC AI Model Bulletin (Dec 2023) adopted in ~23–24 states + DC by late 2025, requiring written AI-Systems programs with validation, testing, accountability, and third-party-AI oversight; a 12-state AI exam-tool pilot running Jan–Sep 2026; ASOP 56 (effective Oct 2020) makes model understanding, change control, reliance-on-others disclosure, and documentation an *individual professional obligation* covering even spreadsheets.
**Consequence:** the documentation burden lands on whatever tooling actuaries use; AI-agent experiments will face examiner scrutiny; a tool whose agents can't produce examiner-facing traces is unsellable to compliance.
**Confidence:** strong (regulatory artifacts + law-firm analyses + standard text; 3 runs, multiple fingerprints).
**Members:** RA-F11, RB-F13, RC-F08(supports), RC-F09.

### CAN-19 — UK regulation already criticizes episodic, manual model governance *(single-run; retained for geographic extension)*
**Claim:** PRA SS1/23 and FCA TR24/2 demand versioned, continuous, auditable model monitoring; FCA found existing monitoring "high-level summaries with little substance"; observed practice is annual reviews, PDF validation reports without version control, and no time-stamped escalation trails — evidence assembled manually at audit time.
**Confidence:** moderate — direction strong, but reached by only one run through one practitioner-adjacent blog citing the underlying regulatory documents second-hand.
**Members:** RD-F08.

### CAN-20 — Precedent exists: an automated-modeling vendor defended its methodology directly to regulators
**Claim:** NAIC hosted an Akur8 GLM methodology and regulatory review (May 2022); regulator-facing transparency material is plausibly table stakes for any automated/AI modeling vendor.
**Confidence:** strong (regulator-hosted artifact, 2 runs).
**Members:** RD-F14, RC-F08(part).

## Contradictions and counter-narratives (also in [contradictions-outliers.md](contradictions-outliers.md))

### CAN-17 — Root cause may be organizational, not tooling *(contradiction, retained)*
**Claim:** Robidoux (The Actuary Magazine, 2021-07): Excel sprawl is a symptom of the actuary–IT organizational split and shadow IT, not the cause — tool replacement without workflow/organizational fit either relocates shadow IT (if it bypasses IT) or inherits the IT bottleneck (if it doesn't). Prediction Lab's BYOC/single-tenant posture reads as an attempt to satisfy both, unvalidated.
**Confidence:** moderate (one well-argued practitioner piece, consistent with the IT-bottleneck survey finding).
**Members:** RA-F10.

### CAN-22 — Incumbent and Excel virtues are real: closedness buys consistency; formulas buy reviewability; some deployments are already fast *(contested)*
**Claim:** Moody's AXIS praised precisely for closed-system consistency across large junior teams; even hyperexponential concedes Excel's formula transparency suits stakeholder review and regulatory audit; G2 Radar Live reviewers call deployment "fast and painless"; a WTW customer story calls Radar "user-friendly." Replacing Excel can *reduce* reviewability if diffs/explanations aren't first-class; flexibility marketing and control/consistency are in genuine tension.
**Confidence:** contested — each individual datum is thin (n≈1 reviews, vendor customer stories), but three runs independently surfaced different instances of the same counter-story, and it survives the anti-pattern check ("legacy is ugly" is not a complete story).
**Members:** RD-F13, RC-F04(challenge)/RC §7, RB §7 (S09).

### CAN-13 — Cross-role buy-in, not modeling capability, blocks model adoption *(single-run outlier, retained)*
**Claim:** 38% of actuaries cite lack of underwriter/business buy-in as the barrier to deploying models; 45% of underwriters say models are "inaccurate or out of date" (hx survey — vendor fingerprint, but the least self-serving finding in it). Model adoption is a cross-role persuasion problem; evidence must be comprehensible to non-modelers.
**Confidence:** tentative (vendor fingerprint, single run) — retained for strategic importance to any evidence/review product.
**Members:** RB-F11(part); RB latent L4.

### CAN-14 — AI-replacement fear among UW/actuaries dropped sharply year-over-year *(single-run outlier, retained)*
**Claim:** 74%/80% (2024) → 48%/49% (2025) per the hx survey family — softening resistance to AI delegation.
**Confidence:** tentative (vendor invested in the narrative, single fingerprint).
**Members:** RB-F12.

## Method finding

### CAN-23 — Practitioner voice is structurally unreachable to desk research; pain quantification is vendor-dominated
**Claim:** 4/4 runs found Reddit fetch-blocked, Actuarial Outpost defunct (404), GoActuary JS-gated (one run recovered a single 2020 post), acted.co.uk empty, web.archive.org blocked. Review sites carry wrong-product or negligible reviews for incumbent actuarial tools. Simultaneously, "modernizer" vendors converge on identical pain talking points — convergence that is incentive-aligned, not corroborating. Net: complaint volume is unmeasured in both directions; satisfied incumbent users are invisible by construction; every headline pain magnitude in this synthesis carries vendor risk.
**Confidence:** strong as a description of this campaign's access; moderate as an ecosystem claim.
**Members:** RA-F14, RD-F12(extends); RB §7, RC §7.
