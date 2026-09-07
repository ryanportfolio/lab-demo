---
aggregation-run-key: run-8de9f1
origin-branch: claude/researching-actuarial-ux-8de9f1
origin-worktree: .claude/worktrees/researching-actuarial-ux-8de9f1
origin-session: 1654d564-5226-42d4-83a2-09288def6dcb
report-delivered: 2026-08-07T17:37:13Z
collected: 2026-08-07
collection-method: extracted verbatim from session transcript (report was returned in-response, never committed; worktree left clean at main tip)
in-session-preamble: "Research pass done. Practitioner-forum access mostly blocked (details in ledger) → labeled as blind spot. Full report below (report body in plain prose per template; blindness kept — no prior reports, no `prediction-lab-actuarial-ux` findings read)."
---

# Independent actuarial UX research report

## 1. Run metadata

- **Campaign ID:** none supplied → `adhoc-2026-08-07`. **Run ID:** `R01`.
- **Date / access window:** 2026-08-07 (single-day desk-research pass).
- **Model/agent:** Claude Fable 5 (claude-fable-5), Claude Code session.
- **Blindness:** Blind. Did not open earlier reports, dedupe outputs, or the findings inside `prediction-lab-actuarial-ux`. Repo docs under `docs/` (design specs) were listed but not read. No known contamination.
- **Lens:** none assigned → full-problem coverage, emphasis fell naturally on pricing/reserving P&C plus life modeling platforms, versioning/governance, and iteration speed.
- **Sources reached:** first-party Prediction Lab pages, vendor sites/press, professional-body and regulatory-adjacent material, job postings, one forum thread. **Missing source classes:** direct practitioner social evidence is badly under-covered — Reddit fetch blocked, Actuarial Outpost defunct (404), ActEd thread 404, GoActuary search returned no software-pain threads. No hands-on product inspection of any incumbent. **Limitation:** several vendor claims captured via search snippets rather than full-page fetches (noted per source).

## 2. Executive synthesis

- **Strongest findings:** (1) Prediction Lab is a real, actively shipped insurance modeling SaaS with a dated public changelog (v1.25.0–v1.35.0, Feb 13 – Jul 16 2026) centered on fast model fitting, review diffs, geographic tooling, and AI agents (F01–F03). (2) Incumbent workflows are demonstrably fragmented: reserving job descriptions require ResQ + Excel + SQL + R/Python in one role (F05). (3) Governance/monitoring is manual and episodic while regulators (PRA SS1/23, FCA TR24/2) now demand versioned, continuous, auditable evidence — a widening compliance gap (F08).
- **Most consequential latent problem:** iteration latency is normalized. Overnight grid runs are a *selling point* in life modeling; price-change deployment historically takes days-to-months. Practitioners don't file this as a complaint — they batch their questions around it (LP1).
- **Strongest contradiction:** Moody's AXIS is praised precisely for being a closed system — consistency across junior teams — while the "modernizer" vendors sell flexibility. Flexibility and control are in real tension; "legacy is rigid" is not a complete story (F14).
- **Highest-value unanswered question:** does any independent (non-vendor) evidence show Prediction Lab or any challenger actually improving actuarial decisions or cycle time in production? None found (F04).

## 3. Prediction Lab: current evidence

**Confirmed first-party claims / shipped capabilities** (S01 accessed 2026-08-07; S02 changelog dated per entry):
- Positioning: "Predictive modeling for insurance," purpose-built for insurance workflows and regulatory requirements; audience = insurance actuaries/modeling teams (S01).
- Performance claim: fit multi-million-record models "in seconds"; "billions of records," distributed architecture, no tuning (S01 — capability claim, not independently verified).
- Versioning/governance: every step versioned and auditable; review workflows with validation outputs and business-impact analysis; dataset review diffs shipped v1.30.0 (Jun 10 2026), richer side-by-side review diffs v1.35.0 (Jul 16 2026); branch deletion confirmation added v1.35.0 (S01, S02).
- Data: connectors to BigQuery, Snowflake, S3, PostgreSQL, Azure, Google Sheets; enrichment from US Census and NOAA (S01).
- AI: "Generative Insights" (ask-your-model Q&A), AI modeling agents that run experiments on new data sources (shipped v1.30.0, Jun 10 2026), framed as "full transparency, complete control"; AI-enhanced reporting explicitly "coming soon" (S01, S02).
- Ops/trust posture: SOC certification claimed, trust portal (trust.predictionlab.ai), public status page (added v1.29.x, ~Jun 2026), enterprise negotiated pricing (S01).
- Cadence: ~weekly-to-biweekly releases Feb–Jul 2026; recent themes: computed columns/expressions, geographic hierarchies and multi-file geographies, model comparisons, dark mode, guided onboarding (S02).

**Reported user/customer outcomes:** none found. No named customers, no case studies, no independent reviews (F04 — negative evidence).

**Researcher inference (labeled inference):** changelog emphasis (GLM-adjacent fitting, geographic rating, review diffs, feature contribution views) suggests current depth is P&C pricing/rating-style modeling rather than life cash-flow projection or reserving triangles. The trust/status/SOC surface plus review workflows suggest a deliberate governance-first enterprise sales posture. "Pay for themselves within the first model cycle" is unverified marketing.

**Unknowns / conflicting signals:** deployment model (SaaS-only vs on-prem/VPC) not established from pages fetched; scope of "AI agents" autonomy and its review/permission model not established; no pricing figures; no evidence of reserving or life-valuation coverage.

## 4. Workflow map

- **P&C pricing actuary → set/refresh rates** → policy+claims extracts → SQL/Excel prep, GLM in Emblem/Akur8/Python → friction: data prep dominates (~25% of time on data quality, S09), slow iteration, siloed tools hard to integrate (S03 vendor claim) → workaround: fragile Excel macros, parallel spreadsheets → consequence: version-control failure modes, key-person risk → handoff: model to rating engine/IT; historically days–months to deploy a price change (S08 vendor negative-space).
- **Reserving actuary → quarterly reserve opinion** → triangles from warehouse → ResQ/Arius + Excel + SQL + R/Python in one role (S13) → friction: multi-tool lineage breaks, manual dashboard upkeep → workaround: rebuilt spreadsheets each close → consequence: reconciliation labor, audit reconstruction → handoff: Finance for external reporting.
- **Life valuation/pricing actuary → reserves/ALM/IFRS 17** → Prophet/AXIS models on compute grids → friction: run latency normalized to overnight ("50,000 scenarios by tomorrow morning," S07 vendor framing) → workaround: batch questions, pre-schedule runs, hire platform specialists (S13) → consequence: exploration rationed; specialist bottlenecks → handoff: risk officers, financial reporting.
- **Validation/governance actuary → model approval & monitoring** → validation reports (PDF), annual A/E reviews → friction: limitations never operationalized, no time-stamped escalation trails, no version control on validation reports (S11) → workaround: manual evidence assembly at audit time → consequence: FCA found monitoring "high-level summaries with little substance" (TR24/2 via S11); SS1/23 raises the bar → handoff: regulators, boards.

## 5. Atomic findings

```text
Finding ID: R01-F01
Canonical claim: Prediction Lab is a live insurance predictive-modeling SaaS shipping continuously (v1.25.0–v1.35.0, Feb 13–Jul 16 2026).
Evidence type: observation (first-party public changelog)
Actor/persona: vendor (Prediction Lab)
Workflow stage and decision: n/a (product current-state)
Product(s) and version context: Prediction Lab v1.25.0–v1.35.0
Observed behavior or artifact: dated changelog entries; status page; trust portal
Source IDs: S01, S02
Independent source classes: 1 (first-party only)
Confidence: strong (for existence/cadence), weak for performance claims
Prediction Lab relevance: baseline current-state
Open validation need: independent verification of performance and customer base
```

```text
Finding ID: R01-F02
Canonical claim: Prediction Lab shipped AI modeling agents (v1.30.0, Jun 10 2026) and generative model Q&A, marketed as transparent and controllable.
Evidence type: vendor claim (existence confirmed first-party; quality/trust properties unverified)
Product(s): Prediction Lab v1.29.x–v1.30.0
Source IDs: S01, S02
Confidence: strong on existence, tentative on behavior
Prediction Lab relevance: AI-delegation posture is a stated differentiator
Open validation need: how agent actions are reviewed, permissioned, refused, audited
```

```text
Finding ID: R01-F03
Canonical claim: Prediction Lab is investing in review/governance UX (dataset review diffs v1.30.0, side-by-side review diffs v1.35.0, destructive-action confirmation).
Evidence type: observation (first-party changelog)
Source IDs: S02
Confidence: strong
Prediction Lab relevance: aligns with regulator-driven audit-trail demand (R01-F08)
```

```text
Finding ID: R01-F04
Canonical claim: No independent user outcomes, named customers, or third-party reviews of Prediction Lab were found.
Evidence type: negative evidence
Source IDs: S01 (absence), search log §9
Confidence: moderate (absence after targeted searching, one-day window)
Prediction Lab relevance: adoption/outcome claims remain unverified
Open validation need: customer interviews, references, independent reviews
```

```text
Finding ID: R01-F05
Canonical claim: A single reserving role routinely spans ResQ/Arius + advanced Excel + SQL + R/Python, i.e. the workflow is inherently multi-tool.
Evidence type: observation (implementation artifacts: job descriptions)
Actor/persona: reserving actuary/analyst
Source IDs: S13
Independent source classes: multiple postings, same artifact class
Confidence: strong
Prediction Lab relevance: integration/lineage across tools is a real surface, not just modeling speed
```

```text
Finding ID: R01-F06
Canonical claim: Roughly 25% of actuarial time goes to data quality issues (GIRO Data Quality working party survey, cited 2008).
Evidence type: practitioner report (survey), dated
Source IDs: S09
Confidence: moderate (credible body; old number; magnitude likely persists per S03/S05 vendor convergence but that is weak corroboration)
Open validation need: current time-use measurement
```

```text
Finding ID: R01-F07
Canonical claim: Excel remains a core pricing substrate and degrades at scale; Aviva reported 20–30 minutes just to open rating tools and download data before migrating.
Evidence type: vendor claim (customer story, hyperexponential)
Actor/persona: commercial/specialty pricing teams
Source IDs: S04, S05
Confidence: moderate (specific, attributable, but commercially motivated)
Prediction Lab relevance: same pain Prediction Lab's speed claims target
```

```text
Finding ID: R01-F08
Canonical claim: Model monitoring/governance is manual and episodic (annual reviews, PDF validation reports, no escalation trails), while PRA SS1/23 and FCA TR24/2 now demand versioned, continuous, reproducible evidence.
Evidence type: practitioner report + regulatory reference (blog mapping to SS1/23; FCA thematic review finding "high-level summaries with little substance"); professional-body practice note corroborates governance expectations
Source IDs: S10, S11
Independent source classes: 2
Confidence: strong on direction, moderate on prevalence quantification
Prediction Lab relevance: audit-trail-as-byproduct is directly responsive
```

```text
Finding ID: R01-F09
Canonical claim: Price-change deployment on incumbent stacks historically takes days to months (WTW markets "minutes rather than days, weeks, or months").
Evidence type: vendor claim (negative-space: vendor's own framing implies incumbent baseline)
Source IDs: S08 (press release, Feb 2025)
Confidence: moderate
```

```text
Finding ID: R01-F10
Canonical claim: In life modeling, overnight grid runs are normalized to the point of being a selling point ("run 50,000 scenarios by tomorrow morning").
Evidence type: vendor claim revealing normalized latency
Product(s): FIS Prophet / Insurance Risk Suite
Source IDs: S07
Confidence: strong that latency is normalized; the workaround culture around it is inference
```

```text
Finding ID: R01-F11
Canonical claim: Tool-specific expertise is hiring currency and a bottleneck: dedicated "Prophet Specialist" roles exist, and one practitioner reports losing a job offer to a candidate with "more Prophet experience."
Evidence type: observation (job postings) + practitioner report (forum, Oct 26 2020)
Source IDs: S13, S14
Independent source classes: 2
Confidence: strong
Prediction Lab relevance: learnability and reduced specialist dependence are latent value props
```

```text
Finding ID: R01-F12
Canonical claim: "Modern" vendors (Akur8, hyperexponential, Dataiku, Prediction Lab) converge on identical pain claims — slow iteration, Excel fragility, weak versioning, poor integration.
Evidence type: vendor claim (convergent but incentive-aligned; NOT independent corroboration)
Source IDs: S01, S03, S05, S06
Confidence: contested as user evidence; strong as market-positioning fact
```

```text
Finding ID: R01-F13
Canonical claim: Closed-system rigidity has genuine UX value: AXIS praised for consistency/ease-of-use across large junior teams precisely because it is closed.
Evidence type: practitioner report (thin: single G2 review via aggregator) — contradiction to the dominant "legacy=bad" story
Source IDs: S15
Confidence: tentative
Prediction Lab relevance: flexibility features must not destroy the consistency/control that closed systems provide
```

```text
Finding ID: R01-F14
Canonical claim: Akur8 sells "10x faster, hours instead of months" GLM building and has presented its methodology directly to NAIC regulators (May 2022).
Evidence type: vendor claim; regulator-facing artifact confirms regulatory-engagement strategy
Source IDs: S06
Confidence: strong on the artifact's existence; performance claims unverified
Prediction Lab relevance: competitor precedent — regulator-facing transparency material may be table stakes
```

## 6. Latent-problem analysis

- **LP1 — Rationed exploration.** Observable: overnight runs marketed as normal (S07); Akur8/PL sell "seconds/hours" (S01, S06). → Normalized workaround: actuaries batch questions, pre-plan run schedules, avoid speculative reruns. → Inferred unmet need: interactive iteration on real portfolios. → Downstream cost: fewer hypotheses tested, weaker models, slower repricing. → Alternative explanation: some compute (nested stochastic life) is irreducible; latency may be physics, not UX. → Validation: observe run queues/telemetry; interview modelers on questions-not-asked.
- **LP2 — Governance evidence assembled after the fact.** Observable: PDF validation reports, missing escalation trails, FCA criticism (S10, S11). → Workaround: manual evidence reconstruction at audit time. → Unmet need: audit trail generated as a byproduct of doing the work. → Cost: audit failures, regulatory findings, rework. → Alternative explanation: organizational (governance under-resourced) rather than tooling; better tools may not fix incentives. → Validation: audit-artifact review at insurers; compare firms on modern vs legacy stacks.
- **LP3 — Lineage lost at tool boundaries.** Observable: single roles spanning ResQ/Excel/SQL/Python (S13); ~25% time on data quality (S09). → Workaround: rebuilt spreadsheets, manual reconciliation each quarter. → Unmet need: continuity of data + assumption lineage across the whole chain. → Cost: reconciliation labor, silent errors, key-person risk. → Alternative explanation: multi-tool stacks may reflect genuinely different jobs, not a missing platform. → Validation: shadow a quarterly close; artifact review of handoff files.
- **LP4 — Specialist moats as learnability debt.** Observable: Prophet-specialist roles and hiring decisions keyed to platform experience (S13, S14). → Workaround: hire/retain platform specialists; queue work behind them. → Unmet need: tools learnable by generalist actuaries. → Cost: bottlenecks, fragility, higher labor cost. → Alternative explanation: domain complexity (not UI) may demand specialists regardless. → Validation: onboarding-time comparisons; training-material review.

## 7. Contradictions, outliers, absences

- Closed-system praise (F13) vs flexibility marketing (F12): control and consistency are features, not merely legacy debt.
- Excel's defenders: even hyperexponential concedes Excel's formula transparency suits stakeholder review and regulatory audit (S05) — replacing Excel can *reduce* reviewability if diffs/explanations aren't first-class.
- Absence: no practitioner complaint corpus reached (forums dead/blocked). Complaint volume here is unmeasured — neither presence nor absence of pain should be inferred (anti-pattern guard).
- Absence: no independent Prediction Lab outcomes (F04). Also no evidence PL covers reserving or life valuation.
- The IFoA "Actuaries excel" paper (S12) is 2006-era — supports only the *longevity* of spreadsheet dependence, not its current shape.

## 8. Source ledger

```text
S01 | https://www.predictionlab.ai/ | Prediction Lab homepage | updated ~2026 (©2026), accessed 2026-08-07 | first-party vendor site | Prediction Lab, current | fingerprint: PL marketing site | Evidence: positioning, features, AI, security, pricing model | Limitation: commercial self-description
S02 | https://www.predictionlab.ai/changelog | Prediction Lab changelog | entries dated 2026-02-13→2026-07-16, accessed 2026-08-07 | first-party product release notes | v1.25.0–v1.35.0 | fingerprint: PL changelog | Evidence: shipped capabilities with dates | Limitation: self-reported, no independent verification
S03 | https://www.dataiku.com/stories/blog/how-dataiku-is-modernizing-the-actuarial-workflow | Dataiku blog | date unknown, accessed 2026-08-07 via search snippet only | vendor (competitor) | Emblem/Radar commentary | fingerprint: Dataiku marketing blog | Evidence: "archaic, siloed, difficult to integrate" characterization | Limitation: competitor claim; NOT fetched in full
S04 | https://www.hyperexponential.com/newsroom/aviva-fast-tracks-pricing | Aviva customer story, hyperexponential | date unknown (~2024–2025), accessed 2026-08-07 via snippet | vendor customer story | Aviva, hx Renew | fingerprint: single hx/Aviva case study (syndicated to responsesource) | Evidence: 20–30 min Excel tool open/download times | Limitation: commercial selection bias; one underlying story counted once
S05 | https://www.hyperexponential.com/blog/excel-alternatives-insurance-pricing (+ /blog/excel-vs-python-for-data-analysis) | hx blog | accessed 2026-08-07 via snippet | vendor | specialty/commercial pricing | fingerprint: hx content marketing | Evidence: Excel scale degradation + concession that Excel aids review/audit | Limitation: vendor
S06 | https://www.akur8.com/ + https://content.naic.org/sites/default/files/call_materials/Akur8%20GLM%20-%20Methodology%20and%20Regulatory%20review.pdf | Akur8 site; NAIC call materials 2022-05-24 | accessed 2026-08-07 | vendor + regulator-facing artifact | Akur8 pricing | fingerprint: Akur8 marketing; NAIC presentation | Evidence: 10x/hours-vs-months claims; regulator engagement | Limitation: vendor claims unverified
S07 | https://www.prophet-web.com/… + https://www.fisglobal.com/products/fis-insurance-risk-suite | FIS Prophet product pages | accessed 2026-08-07 | vendor | Prophet/Insurance Risk Suite | fingerprint: FIS product marketing | Evidence: grid compute, overnight-scenario framing, 10,000 users/1,000 sites/70 countries scale claim | Limitation: vendor
S08 | https://www.globenewswire.com/…/2025/02/06/…wtw-debuts-new-insurance-pricing… | WTW press release | 2025-02-06, accessed 2026-08-07 | vendor press | Radar + Guidewire PolicyCenter | fingerprint: single WTW PR (syndicated to yahoo/barchart/slipcase) | Evidence: "minutes rather than days, weeks, or months" | Limitation: vendor; syndication ≠ corroboration
S09 | https://www.casact.org/sites/default/files/database/forum_08wforum_actuarialiq.pdf | "Actuarial I.Q.", CAS E-Forum Winter 2008 | 2008, accessed 2026-08-07 | professional body | GI data quality | fingerprint: GIRO Data Quality WP survey (underlying) | Evidence: ~25% of time on data quality | Limitation: dated
S10 | http://actuary.org/files/publications/Model_Governance_PN_042017.pdf | Model Governance practice note, American Academy of Actuaries | 2017-04, accessed 2026-08-07 | professional body | US model governance | fingerprint: AAA practice note | Evidence: governance expectations | Limitation: US-centric, 2017
S11 | https://burning-cost.github.io/2026/04/05/pra-auditors-2026-ss123-pricing-model-monitoring/ | Burning Cost blog | 2026-04-05, accessed 2026-08-07 | practitioner-adjacent open blog | UK pricing, PRA SS1/23, FCA TR24/2 | fingerprint: independent blog citing FCA TR24/2 + PRA SS1/23 (underlying regulatory docs) | Evidence: manual/episodic monitoring, PDF validation reports, missing trails | Limitation: authorship not fully identified; regulatory quotes second-hand
S12 | https://www.actuaries.org.uk/system/files/documents/pdf/actuaries-excelbut-what-about-their-software.pdf | "Actuaries excel: but what about their software?" IFoA | ~2006, accessed 2026-08-07 | professional body | spreadsheet practice | fingerprint: 2006 survey paper | Evidence: long-standing spreadsheet dependence, variable testing maturity | Limitation: 20 years old; PDF extraction partial
S13 | builtin.com Prophet Specialist postings; ziprecruiter/acturhire/ipsgroup reserving postings | job postings | current 2026, accessed 2026-08-07 | implementation artifacts | ResQ/Prophet/Excel/SQL/R/Python stacks | fingerprint: independent employer postings (multiple employers) | Evidence: multi-tool requirements; specialist roles | Limitation: postings describe desired skills, not observed workflow
S14 | https://community.goactuary.com/ thread "Quitting a Job You Actually Like" | GoActuary forum | 2020-10-26, accessed 2026-08-07 | direct practitioner evidence | Prophet hiring | fingerprint: single forum post (user "Tiffany") | Evidence: hiring decided by Prophet experience | Limitation: single anecdote
S15 | https://www.g2.com/products/moody-s-analytics-axis/reviews | G2 AXIS reviews | accessed 2026-08-07 via search summary | user-review platform | Moody's AXIS | fingerprint: ~1 review only | Evidence: closed-system consistency praise | Limitation: n=1, not directly fetched
S16 | wifitalents.com / devopsschool.com / guideflow listicles | "best actuarial software" roundups | 2026, accessed 2026-08-07 | SEO aggregator (low trust) | market map only | fingerprint: recycled vendor copy | Evidence: product landscape names only | Limitation: not treated as evidence of pain or capability
```

## 9. Search log and coverage

- Queries: Prediction Lab first-party (+changelog fetch); Emblem/Radar practitioner friction; Prophet/AXIS runtime + EUC; SOA technology survey; hyperexponential/Akur8 claims; model governance + PRA/audit trail; reserving time-use surveys; reserving job descriptions; G2/Capterra reviews; multiple Reddit/forum attempts.
- **Failed/blocked (material blind spots):** reddit.com fetch refused by tool; actuarialoutpost.com defunct (404); ActEd thread 404; GoActuary search yielded only off-topic hits plus one relevant post; soa.org AIT survey page 404. Direct practitioner voice is therefore the weakest class in this run.
- Saturation: vendor-claim class saturated quickly (convergent messaging); professional/regulatory class produced steady value; practitioner class never reached saturation — stopped due to access, not exhaustion.

## 10. Open questions (ranked, with validation method)

1. Do any production users corroborate Prediction Lab's speed/governance claims? → customer interviews, reference checks.
2. How do actuaries actually spend a model cycle today (2026 numbers, not 2008)? → time-use observation or support/telemetry analysis.
3. Is iteration latency in life modeling reducible, or physics? → technical artifact review + interviews with Prophet/AXIS modelers.
4. How is AI-agent work reviewed/permissioned/refused in Prediction Lab, and will validation actuaries and regulators accept agent-produced experiments? → product inspection + interviews with validation actuaries.
5. Does replacing Excel reduce reviewability for stakeholders who audit via formulas? → usability test of review/diff surfaces with reviewers, not modelers.
6. Where does Prediction Lab sit vs reserving and life valuation workflows (out of scope or roadmap)? → additional first-party sources, sales material, interviews.

## 11. Self-check

- Factual claims carry source IDs; inferences labeled (§3 inference block, LP chains, F10/F12 partials).
- Current-state Prediction Lab claims dated (accessed 2026-08-07; changelog entries per-date).
- Vendor claims flagged throughout; convergent vendor messaging explicitly not treated as corroboration (F12).
- Shared underlying sources fingerprinted (Aviva story syndication, WTW PR syndication, GIRO WP).
- Findings atomic with run-local IDs, mergeable without loss.
- No conclusions imported from prior research; practitioner-evidence gap disclosed rather than papered over.

---

Report complete. Biggest caveat: practitioner voice thin → run's latent-problem chains lean on inference + vendor negative-space. Next pass ideas: interviews, or archive.org sweep of dead Actuarial Outpost threads. Want report saved to file / PR'd somewhere? Say where.