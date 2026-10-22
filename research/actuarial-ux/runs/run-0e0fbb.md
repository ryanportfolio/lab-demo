---
aggregation-run-key: run-0e0fbb
origin-branch: claude/researching-actuarial-ux-0e0fbb
origin-worktree: .claude/worktrees/researching-actuarial-ux-0e0fbb
origin-session: d3b2f628-0160-44ef-8d1a-e541bfddc498
report-delivered: 2026-08-07T17:43:21Z
collected: 2026-08-07
collection-method: extracted verbatim from session transcript (report was returned in-response, never committed; worktree left clean at main tip)
in-session-preamble: "Research saturated. Writing report now — deliverable in full prose per template (caveman off for report body, per auto-clarity)."
---

# Independent research report — Actuarial modeling UX

## 1. Run metadata

- **Campaign ID:** none supplied (ad-hoc invocation) · **Run ID:** R01-20260807
- **Date / access window:** 2026-08-07, single session
- **Model/agent:** Claude Fable 5 (claude-fable-5), Claude Code session
- **Blindness:** Blind. Did not open prior reports, `prediction-lab-actuarial-ux` skill findings, or synthesis files. Only skill files read were this skill's own brief and template. Repo browsing was limited to directory names.
- **Assigned lens:** none (full problem coverage)
- **Scope:** Prediction Lab (predictionlab.ai); incumbent tools referenced: Excel, FIS Prophet, Moody's/GGY AXIS, MG-ALFA, WTW Radar/Emblem, ResQ, Akur8, Earnix, hyperexponential hx Renew; personas: P&C pricing actuaries, reserving actuaries, life valuation/modeling actuaries, model governance staff, regulators; geography mostly US/UK.
- **Sources reached:** 20+ (ledger §8). **Source classes missing or thin:** direct forum-level practitioner voices (Reddit, GoActuary, Actuarial Outpost all unreachable — §9), hands-on product inspection of incumbents (license-gated), Prediction Lab in-app inspection (login-gated), credible third-party reviews of Prediction Lab (none found).

## 2. Executive synthesis

- **Strongest findings:** (1) The dominant "product" across actuarial workflows is still the spreadsheet plus a heavyweight specialist modeling platform, held together by file-name versioning, changelog tabs, shared drives, and email-based review — described in exactly those terms by an SOA-published practitioner in Feb 2026 (S05). (2) Latency is pervasive and normalized at three distinct layers: model build/fill-in (about half of surveyed actuaries need a week or more per pricing model — vendor survey, S10), compute (a decade of SOA literature on taming nested-stochastic run times, S18/S19), and deployment (median ~4 months to get a significant rate change to market; no surveyed insurer under 1 month — vendor survey, S12). (3) Compensating behaviors are visible and public: practitioners building open-source replacements (chainladder-python, lifelib) explicitly citing transparency, reproducibility, and vendor lock-in (S16, S17), and senior actuaries hand-optimizing loop bounds and table reads to claw back run time (S19).
- **Most consequential latent problem:** reproducibility-on-demand. Regulators (CASTF information elements, NAIC AI bulletin's AIS-program expectations, 2026 AI exam-tool pilot) increasingly demand that an insurer explain exactly which model version, data, and assumptions produced a filed number — while the prevailing toolchain records history in "Model_Final_v23.xlsm" naming and email chains. The gap between what governance demands and what tooling records is widening.
- **Strongest contradiction:** Robidoux (The Actuary Magazine, Jul 2021, S15): Excel is a *symptom* of a broken actuary–IT relationship, not the cause — a warning that pure tool replacement without workflow/organizational fit fails. Also hyperexponential's own survey says only 8% of insurers rely *solely* on spreadsheets (S10), so the problem is fragmentation across tools, not Excel monoculture.
- **Highest-value unanswered question:** how model *evidence* (charts, diagnostics, exact values) actually moves through review committees and into filings today — no direct observational source reached; largely inference (§10, OQ1).

## 3. Prediction Lab: current evidence

**Confirmed first-party claims (all accessed 2026-08-07):**
- Positioning: "Predictive modeling for insurance"; "Build, test, and deploy models faster"; "Fit complex models instantly, version every change, and let AI surface the insights you'd miss" (S01).
- Claimed capabilities (homepage, S01): fast model fitting ("multi-million record model in seconds" per search-indexed copy), full lifecycle in one platform, every step versioned/auditable, AI Q&A over models plus AI agents running experiments, data connectors (BigQuery, Snowflake, S3, PostgreSQL, Azure, Google Sheets), external enrichment (US Census, NOAA), model review workflows, API deployment endpoints; "AI-Enhanced Reporting" marked coming soon.
- Shipped features with dates (changelog, S02): single-tenant deployment (v1.19.0, 2026-02-13); Bring Your Own Cloud (v1.20.0, 2026-02-20); SOC 2 Type II announcement (v1.23.0, 2026-03-13); model import/export, Lorenz curves, feature importance, AI assistant integration (v1.29.0, 2026-05-30); public status page (v1.29.1, 2026-06-02); dataset review diffs + "AI Modeling Agents" (v1.30.0, 2026-06-10); model comparisons with fit deltas, map views (v1.31.0, 2026-06-15); computed columns/expression builder, geographic hierarchies, dark mode (v1.33.0–v1.34.0, Jun–Jul 2026); richer review diffs, expression-powered datasets (v1.35.0, 2026-07-16). Cadence ≈ weekly-to-biweekly since Feb 2026.
- Company: small remote US team; hiring Actuarial Engineer, Design Engineer, ML Engineer, Platform Engineer, Product Engineer (S03). Enterprise custom pricing; claims "most implementations pay for themselves within the first model cycle" (S01 — vendor claim, unverified).
- App is login-gated behind WorkOS AuthKit (`/downloads` → api.workos.com redirect, S04) — enterprise SSO posture; no self-serve trial observed.

**Reported user/customer outcomes:** none found. No case studies, named customers, or third-party reviews reachable this run. (Negative evidence — see §7.)

**Researcher inference (labeled):** feature sequence (single-tenant → BYOC → SOC 2 → review diffs → AI agents) reads as an enterprise-procurement-first strategy aimed at insurer IT/security gates before broad UX polish; review-diff investment suggests targeting the audit/reproducibility gap directly. Inference, not confirmed by any first-party statement of strategy.

**Unknowns / conflicting signals:** funding, customer count, line-of-business focus (P&C pricing vs life), how AI agents are permissioned/reviewed, on-prem story beyond BYOC, pricing magnitude. Trust page (trust.predictionlab.ai) returned 403 to this agent, so SOC 2 detail is unverified beyond the changelog claim.

## 4. Workflow map

- **P&C pricing actuary** → decide rate/relativity changes → policy/claims extracts → Excel + GLM tool (Emblem/Radar/Akur8/Earnix or in-house R/Python) → friction: data prep dominance, week-to-month model fill-in (S10), iteration latency of manual GLM (S11 vendor claim) → workaround: reuse last year's model shell, limit variable search → consequence: stale rating structures → handoff: filing support exhibits to regulator (CASTF info elements, S13) and rating engine implementation via IT (median ~4 months, S12; IT bottleneck, S07).
- **Reserving actuary** → set IBNR/best estimate → triangles from warehouse → ResQ/Arius/Excel → friction: quarter fast-close pressure (S08), method-selection labor, spreadsheet silos (S22, S23) → workaround: open-source DIY pipelines (S16, S17) → consequence: key-person risk, weak reproducibility → handoff: reserve committee pack, then audit.
- **Life valuation/modeling actuary** → produce reserves/capital/hedging numbers → assumption tables + inforce → Prophet/AXIS/MG-ALFA on grids → friction: run time (nested stochastic; overnight/multi-day batches implied by a decade of runtime-reduction research, S18) → workaround: model-point compression, tail-only scenario runs (S18: 2026 Koernig article), hand-optimized loops/table reads (S19) → consequence: fewer sensitivities explored; senior-FSA time spent on performance engineering (S20) → handoff: results to valuation/ALM plus Model Risk Management documentation.
- **Model governance/steward** → prove which version produced which filed number → model files, memos, email chains → shared drives + naming conventions + changelog tabs (S05) → friction: no authoritative version, overwrite risk, manual audit memos → workaround: Git adoption advocacy (S05), dedicated governance roles → consequence: audit vulnerability as NAIC AI exam scrutiny rises (S13, S14).

## 5. Atomic findings

```text
Finding ID: R01-F01
Canonical claim: Spreadsheets remain central production infrastructure across actuarial pricing, reserving, and reporting, decades after purpose-built platforms appeared.
Evidence type: practitioner report (multiple) + vendor claim (surveys)
Actor/persona: all actuarial roles
Workflow stage and decision: all stages
Product(s) and version context: Excel; era 2015–2026
Observed behavior or artifact: practitioner articles on spreadsheet production risk (2015–2021); vendor surveys of practitioners (2023–2024); "electronic worksheets still the primary tool" (The Actuary Magazine 2022 via search)
Workaround or compensating behavior: shadow-IT Excel systems (S15); spreadsheet "masterpieces" (S22)
Consequence: error, audit, key-person, and scale risk
Source IDs: S09, S10, S15, S22, S23
Independent source classes: professional-body article, practitioner article, vendor survey
Evidence supporting: consistent across classes and a decade
Evidence challenging: hx survey: only 8% rely *solely* on spreadsheets (S10) — coexistence, not monoculture
Confidence: strong
Why: multi-class, multi-year corroboration
Prediction Lab relevance: its "full lifecycle in one platform" pitch attacks exactly this fragmentation
Design question: what workflow lets actuaries keep spreadsheet-grade flexibility while gaining platform-grade audit?
Open validation need: current (2025–26) non-vendor usage share by task
```

```text
Finding ID: R01-F02
Canonical claim: Model version identity is managed by file naming, changelog tabs, shared drives, and email — leaving the authoritative version unclear.
Evidence type: practitioner report
Actor/persona: modeling and governance actuaries
Workflow stage: change management, review, audit
Product context: Excel/Python/SQL model assets, 2026
Observed artifact: "Model_Final_v23.xlsm" naming; changelog tabs; manual memos and email chains (S05, Cody, SOA, 2026-02-18)
Workaround: Git advocated as remedy; pull-request-style peer review
Consequence: overwrites, unreproducible past results, audit vulnerability
Source IDs: S05; corroborated by S22 (version control named an inherent spreadsheet weakness)
Independent source classes: professional-body newsletter (practitioner-authored), practitioner article
Evidence challenging: none found
Confidence: strong
Why: recent, concrete, first-hand description in professional venue
Prediction Lab relevance: "every change versioned," review diffs (v1.30/v1.35) map directly
Design question: can version identity survive round-trips to Excel/PowerPoint where committee work actually happens?
Open validation need: observation of a real quarterly update cycle
```

```text
Finding ID: R01-F03
Canonical claim: A large share of actuaries find their pricing technology hard to audit and report from.
Evidence type: vendor claim (commissioned practitioner survey)
Actor/persona: specialty/commercial pricing actuaries & underwriters
Workflow stage: audit, reporting, governance
Product context: mixed Excel + pricing platforms, 2023–24
Observed artifact: hx State of Pricing: 47% say current tech difficult to audit/report from; 96% say pricing tech needs improvement (up from 84% in 2023)
Source IDs: S09, S10 (single underlying survey — one fingerprint)
Independent source classes: one (vendor survey), directionally consistent with S05, S13
Evidence challenging: sponsor sells the cure; sample skews specialty London-market
Confidence: moderate (directionally), tentative (exact numbers)
Why: commercial bias + single fingerprint
Prediction Lab relevance: audit-trail positioning
Open validation need: independent replication (professional body survey)
```

```text
Finding ID: R01-F04
Canonical claim: Building/filling a pricing model takes a week or more for about half of actuaries surveyed; a month for ~20%.
Evidence type: vendor claim (survey)
Actor/persona: pricing actuaries
Workflow stage: model build/parameterization
Source IDs: S10
Independent source classes: one
Evidence supporting: consistent with Akur8's "manual GLM iterations are long and slow" (S11 — also vendor) and CASTF-documented model complexity (S13)
Confidence: tentative-to-moderate
Why: vendor fingerprint only
Prediction Lab relevance: "fit models in seconds" targets this directly, but fitting ≠ the whole fill-in labor (data prep, judgment, sign-off)
Open validation need: time-and-motion observation of one model cycle
```

```text
Finding ID: R01-F05
Canonical claim: Deploying a significant rate/pricing change to production takes months (median ~4; none under 1 month; 58% >5 months for rule changes), with IT bottlenecks a named cause.
Evidence type: vendor claim (Earnix surveys) + vendor-adjacent survey (WTW, 59 P&C insurers, 2026)
Actor/persona: pricing actuary → IT/rating engine
Workflow stage: deployment/implementation
Source IDs: S12, S07
Independent source classes: two vendor-linked surveys, different sponsors (distinct fingerprints)
Evidence challenging: sponsors sell deployment speed; samples differ
Confidence: moderate
Why: two distinct commercial sources agree on direction and scale
Prediction Lab relevance: API endpoint deployment claim; but rating-engine/filing integration unproven
Open validation need: insurer-side case timeline (filing artifacts)
```

```text
Finding ID: R01-F06
Canonical claim: Compute latency is a structural constraint in life/annuity modeling; actuaries reshape analysis scope (model-point compression, tail-only runs, proxy models) to fit run-time budgets.
Evidence type: observation (professional literature spanning 2016–2026)
Actor/persona: life valuation/ALM actuaries
Workflow stage: projection runs, capital/hedging
Product context: Prophet/AXIS/MG-ALFA-class platforms on grids/cloud
Observed artifact: SOA research program on nested-stochastic runtime (2016, 2021, 2023); 2026 article: run full projections on tail scenarios only to cut run time (S18)
Workaround: scenario budget rationing; ML proxies
Consequence: fewer sensitivities examined; uncertainty under-explored
Source IDs: S18, S19, S24 (report exists; PDF unreadable this run)
Independent source classes: professional body research + practitioner article
Confidence: strong (existence/persistence), moderate (magnitude)
Prediction Lab relevance: speed claims target the GLM/ML pricing side; heavy life projection workloads are a different compute class — unknown fit
Open validation need: current run-time distributions by platform
```

```text
Finding ID: R01-F07
Canonical claim: Senior actuaries spend time hand-optimizing model code mechanics (loop bounds, table-read frequency) to recover run time.
Evidence type: observation (published optimization guide)
Actor/persona: senior modeling actuaries
Workflow stage: model maintenance
Observed artifact: SOA 2025-09-16 guide: 85% loop-iteration cut by fixing loop boundaries; >90% table-read reduction; "test rigorously to ensure performance improvements don't alter results" (S19)
Workaround: this IS the workaround — performance craft as actuarial skill
Consequence: expensive expert time on plumbing; risk of behavior-altering "optimizations"
Source IDs: S19
Confidence: strong
Prediction Lab relevance: engine-level speed removes this labor class if credible
```

```text
Finding ID: R01-F08
Canonical claim: Incumbent platforms create deep specialist dependence — dedicated senior-FSA roles exist solely to develop/debug/peer-review models in one vendor tool.
Evidence type: observation (implementation artifacts: job postings)
Actor/persona: Prophet/AXIS/MG-ALFA specialists
Observed artifact: Pacific Life "Senior Actuary (FSA) – Prophet Modeler," $163k–$200k, duties: develop/test/debug Prophet models, peer review, act as internal Prophet expert (S20, removed 2025-12-08); multiple similar AXIS/MG-ALFA postings (search-level); FIS claims 9,000+ Prophet users / 730+ sites (S21, vendor)
Consequence: key-person risk, high switching costs, training moats
Source IDs: S20, S21
Independent source classes: implementation artifact + vendor stat
Confidence: strong
Prediction Lab relevance: "Actuarial Engineer" hiring (S03) suggests awareness that domain-tool translation is a product function, not a customer burden
```

```text
Finding ID: R01-F09
Canonical claim: Practitioners build and adopt open-source actuarial tooling explicitly because proprietary tools lack transparency, reproducibility, and affordability and impose lock-in.
Evidence type: observation (public repos) + practitioner report
Observed artifact: chainladder-python (CAS-hosted), lifelib, modelx, ChainLadder-R; CAS E-Forum practitioner guide: built so you "no longer have to rely on outdated softwares"; Actuarial Review 2024-02-29: transparency/reproducibility/vendor-independence drivers (S16, S17)
Workaround: DIY pipelines replacing vendor reserving tools
Consequence: latent demand signal for transparent, scriptable, cheap modeling infrastructure
Source IDs: S16, S17
Independent source classes: professional-body magazine, public code artifacts, CAS paper
Confidence: strong
Evidence challenging: CAS First Annual Technology Survey (via S23): >80% cite time as biggest barrier to learning new tech → open-source path serves a coder minority
Prediction Lab relevance: same needs, GUI-first delivery — potentially serving the non-coder majority
```

```text
Finding ID: R01-F10
Canonical claim: Root cause of spreadsheet sprawl is organizational (actuary–IT split since the 1980s, shadow IT), not the spreadsheet itself.
Evidence type: contradiction (practitioner counter-argument)
Observed artifact: Robidoux, The Actuary Magazine, Jul 2021: "Excel is a massive signal of a problem, but Excel itself is not to blame" (S15)
Consequence for product strategy: tools that bypass IT get adopted but re-create shadow IT; tools that require IT get stuck in the same bottleneck (cf. S07 IT-bottleneck finding)
Source IDs: S15, S07
Confidence: moderate (one well-argued practitioner piece, consistent with S07)
Prediction Lab relevance: BYOC/single-tenant options read as an attempt to satisfy IT while selling to actuaries — adoption path worth validating
```

```text
Finding ID: R01-F11
Canonical claim: Regulatory demand for model traceability is rising: CASTF's GLM filing "information elements," the NAIC AI Model Bulletin (adopted in ~23–24 states + DC by late 2025) requiring a written AI Systems Program with validation/testing/third-party oversight, and a 12-state AI exam-tool pilot running Jan–Sep 2026.
Evidence type: observation (regulatory artifacts)
Actor/persona: regulators; insurer compliance/governance
Source IDs: S13, S14
Independent source classes: regulator documents + law-firm analyses
Confidence: strong
Consequence: documentation/reproducibility burden lands on whatever tooling actuaries use; AI-assisted modeling gets explicit exam scrutiny
Prediction Lab relevance: audit trails and review workflows align; but its own AI agents will fall under AIS-program third-party-AI oversight — a sales obstacle and design constraint
Design requirement (supported): AI-agent actions must be loggable, attributable, reviewable, and explainable to a market-conduct examiner
```

```text
Finding ID: R01-F12
Canonical claim: Prediction Lab is a live, actively shipped (weekly-cadence) enterprise SaaS for insurance predictive modeling, with versioning/review/AI-agent features shipped Feb–Jul 2026.
Evidence type: observation (first-party site + changelog)
Source IDs: S01, S02, S03, S04 (all accessed 2026-08-07)
Confidence: strong for existence/claims; unverified for real-world behavior (no customer evidence)
```

```text
Finding ID: R01-F13
Canonical claim: No independent user evidence (reviews, case studies, forum mentions, named customers) for Prediction Lab was findable this run.
Evidence type: negative evidence
Source IDs: search log §9
Confidence: moderate (absence after multiple queries; young company + gated app plausibly explains it)
Consequence: all capability claims remain vendor claims
```

```text
Finding ID: R01-F14
Canonical claim: Public practitioner discussion channels for actuarial software are structurally scarce: Actuarial Outpost archive dead (404), Reddit/goactuary unreachable to this agent, review sites (Capterra/G2) contain wrong-product or negligible reviews for incumbent actuarial tools.
Evidence type: negative evidence / access limitation
Source IDs: S25 + §9
Consequence: pain evidence over-relies on vendor-commissioned surveys and professional-body articles → selection bias toward modernization narratives; silent-majority workflows (satisfied AXIS shops, etc.) underrepresented
Confidence: strong (as a description of this run's access), moderate (as a claim about the ecosystem)
```

## 6. Latent-problem analysis

1. **Version identity** — observable: `_v23_final` filenames, changelog tabs (S05) → normalized as "how it's done" → unmet need: authoritative, diffable model lineage → downstream cost: audit failure risk, unreproducible filings (S13/S14 raise stakes) → alternative explanation: some shops already run Git/DevOps (Pacific Life lists Azure DevOps, S20) → validation: artifact review of a real quarterly cycle at 2–3 insurers.
2. **Run-time rationing of curiosity** — observable: tail-only runs, model-point compression, hand-optimization guides (S18, S19) → normalized: "the overnight batch" as fact of life → unmet need: interactive-latency experimentation → cost: unexplored sensitivities, weaker uncertainty communication → alternative explanation: some rationing is statistically principled (proxy models are legitimate) → validation: run-time telemetry or interviews on abandoned analyses ("what didn't you test?").
3. **Evidence detachment at review** — observable: manual memos/email review (S05); CASTF exhibit demands (S13); Prediction Lab building review diffs (S02) → inferred: charts/diagnostics get exported to static decks/spreadsheets, severing link to model version → cost: committees approve artifacts that can't be traced back → **this chain is mostly inference this run** — no direct observation of committee practice reached → validation: observe a pricing/reserve committee pack's production.
4. **Specialist moats as normalized cost** — observable: dedicated vendor-tool FSA roles at $200k (S20), 80%+ citing no time to learn new tech (S23) → unmet need: modeling power without platform-language mastery → cost: key-person risk (S22), slow onboarding, consultant dependence → alternative explanation: irreducible domain complexity, not tool complexity → validation: onboarding-time comparison across platforms.

## 7. Contradictions, outliers, absences

- **Robidoux counter-narrative (S15):** organizational split, not tooling, is root cause — a better tool alone may just relocate shadow IT.
- **hx's own 8% figure (S10):** pure-spreadsheet shops are a small minority; the real state is *hybrid* stacks — fragmentation between tools, not absence of tools.
- **Open-source vs time-barrier tension:** enthusiasm for R/Python (S16) vs >80% citing time as the barrier (S23) — the coding path does not generalize to the median actuary.
- **Absence:** no findable independent Prediction Lab user evidence (F13); no findable current practitioner complaints *specific* to Emblem/Radar/ResQ UI (channels dead or unreachable — F14). Absence of complaints here is an access artifact, not evidence of satisfaction.
- **Vendor-survey monoculture risk:** the three headline pain quantifications (96% improvement need, 47% week+ fill-in, 4-month deployment) all come from vendors selling remedies (hx, Earnix) — direction corroborated across sponsors, magnitudes unverified.

## 8. Source ledger

```text
S01 | https://www.predictionlab.ai/ | Prediction Lab homepage | undated, acc. 2026-08-07 | vendor positioning | fingerprint: PL-firstparty | claims: capabilities, pricing posture | bias: marketing
S02 | https://www.predictionlab.ai/changelog | PL changelog v1.19.0–v1.35.0 | 2026-02-13→2026-07-16, acc. 2026-08-07 | vendor release notes (highest-value first-party) | fingerprint: PL-firstparty | dated shipped features | bias: self-reported
S03 | https://www.predictionlab.ai/careers | PL careers | acc. 2026-08-07 | vendor implementation artifact | 5 open US-remote engineering roles incl. Actuarial Engineer | bias: none material
S04 | https://www.predictionlab.ai/downloads | redirect → api.workos.com AuthKit | acc. 2026-08-07 | direct observation | login-gated app, WorkOS SSO | limitation: no app access
S05 | https://www.soa.org/communities/emerging-topics/newsletter-articles/2026/february/2026-02-et-cody/ | Cody, "Enhancing Actuarial Model Governance with Version Control and Git," SOA | 2026-02-18, acc. 2026-08-07 | professional body, practitioner-authored | fingerprint: Cody2026 | version chaos, Git remedy
S06 | https://www.soa.org/resources/research-reports/2017/2017-01-actuarial-model-governance/ | SOA/Deloitte model governance survey | 2017 | professional body survey | landing page only; PDF unread — limitation
S07 | https://www.wtwco.com/en-us/news/2026/03/insurers-using-advanced-analytics-and-ai-report-strong-returns-on-investment-and-premium-growth | WTW 2026 Advanced Analytics & AI Survey (59 P&C insurers) | 2026-03 | vendor-adjacent survey | fingerprint: WTW2026survey | IT-bottleneck deployment finding | accessed via search snippet only (fetch 429)
S08 | https://www.jstor.org/stable/44081195 | ROC/TORP Working Party, "Fast Close," BAJ 20(3) | 2015 | professional body | reserving process time pressure | dated
S09 | https://www.reinsurancene.ws/96-of-underwriters-actuaries-say-pricing-tech-needs-improvement-hyperexponential/ | Reinsurance News on hx survey | 2024 | trade press relaying vendor survey | fingerprint: hxStateOfPricing2024 (same as S10)
S10 | https://www.hyperexponential.com/resources/2025-state-of-pricing-report (+blog pages) | hx State of Pricing 2024/2025 | vendor-commissioned survey | fingerprint: hxStateOfPricing2024 | 96%/47%/8% stats | bias: sells pricing platform
S11 | https://www.akur8.com/ (+Celent listing) | Akur8 positioning | acc. 2026-08-07 | vendor claim | manual-GLM-slow narrative, months→hours claim | bias: sells automated GLM
S12 | https://earnix.com/newsroom/... + businesswire 2024-11-04 | Earnix surveys | 2024 | vendor-commissioned | fingerprint: EarnixTrends2024 | 4-mo median rate change; 58%>5mo | bias: sells deployment speed
S13 | https://content.naic.org/sites/default/files/inline-files/Predictive%20Model%20White%20Paper%20Exposed%208-3-19.pdf + NAIC Model Review Manual (adopted CASTF 2025-11-04) | NAIC CASTF | 2019/2025 | regulatory | fingerprint: CASTF-WP | information elements, filing review burden
S14 | https://www.kennedyslaw.com/... + https://www.fenwick.com/... | NAIC AI Model Bulletin analyses | 2025, acc. 2026-08-07 | law-firm analyses of regulatory artifact | fingerprint: NAIC-AIB-2023 | 23-24 states+DC adoption; 2026 exam-tool pilot (12 states)
S15 | https://www.theactuarymagazine.org/excel-is-not-the-culprit/ | Robidoux, The Actuary Magazine | 2021-07 | practitioner article | fingerprint: Robidoux2021 | org-cause counter-argument
S16 | https://ar.casact.org/the-rise-of-open-source-tools-for-actuaries/ | Hsu & Fannin, Actuarial Review | 2024-02-29 | professional body magazine | open-source drivers; CAS tech survey reference
S17 | https://github.com/casact/chainladder-python + https://eforum.casact.org/article/123379-... | chainladder-python + CAS E-Forum practitioner guide | acc. 2026-08-07 | public code artifact + CAS paper | fingerprint: chainladder | DIY motivation quotes
S18 | SOA nested-stochastic/runtime corpus: /2016/nested-stochastic-modeling/, /2021/efficient-computation-nested-stochastic/, /2023/predictive-analytics-and-machine-learning/, /2026/june/2026-06-et-koernig/ | 2016–2026 | professional body research | runtime constraint persistence; tail-only runs | search-level + landing pages
S19 | https://www.soa.org/digital-publishing-platform/emerging-topics/et-2025-09-farmer/ | Farmer/Grote/Prazak/Wallen, "Optimizing Open System Actuarial Models," SOA | 2025-09-16 | professional body, practitioner-authored | 85%/90% optimization stats
S20 | https://builtin.com/job/senior-actuary-fsa-prophet-modeler/7300816 | Pacific Life Prophet Modeler posting | removed 2025-12-08, acc. 2026-08-07 | implementation artifact | specialist-dependence duties, $163-200k
S21 | businesswire 2020-06-25 (FIS) | Prophet scale stats | 2020 | vendor claim | 9,000 users/730 sites/65 countries | dated, marketing
S22 | Kester, "6 Top Dangers of Actuarial Spreadsheets" (LinkedIn Pulse; SOA Compact 2015 companion) | ~2015 | practitioner article | key-person/staffing risk | accessed via search snippet only — limitation
S23 | https://www.coherent.global/blog/pain-points-of-the-modern-actuary-and-how-to-solve-for-them | Coherent blog | upd. 2024-07-03 | vendor blog | relays CAS First Annual Technology Survey (>80% time barrier) | fingerprint of stat: CAS-TechSurvey1 | bias: sells Excel-to-API
S24 | https://www.soa.org/.../2019/cloud-computing.pdf | SOA Cloud Computing & ML report | 2019 | professional body | PDF binary unreadable this run — cited for existence only
S25 | actuarialoutpost.com archive (404), community.goactuary.com (JS-blocked), reddit.com + old.reddit.com (fetch-blocked), web.archive.org (fetch-blocked), trust.predictionlab.ai (403), capterra Radar page (wrong product) | negative/access evidence
```

## 9. Search log and coverage

- **Queries run (major):** Prediction Lab identity/product/changelog/careers; r/actuary + site:reddit.com software-pain variants (×4, all failed to surface Reddit content); goactuary/acted/Outpost forum probes; SOA model governance survey + Git article; WTW pricing-team time survey; IFoA GIRO/TORP reserving; hx State of Pricing; Akur8 GLM claims; Earnix deployment-time stats; NAIC CASTF white paper; NAIC AI bulletin adoption; chainladder/open-source motivation; The Actuary spreadsheet articles; spreadsheet key-person risk; SOA runtime/nested-stochastic/cloud corpus; job-posting artifacts.
- **Classes covered:** first-party vendor (Prediction Lab, deep), professional body (SOA/CAS/IFoA, deep), regulatory (NAIC, moderate), implementation artifacts (job posts, code repos, moderate), vendor surveys (labeled, deep), trade press (light), practitioner articles (moderate).
- **Blocked/failed searches that matter:** Reddit (both fetch domains refused), web.archive.org refused, Actuarial Outpost archive 404 (forum defunct), goactuary JS-shell only, trust.predictionlab.ai 403, WTW survey page 429, SOA PDFs unreadable (no poppler for local render), Capterra "Radar" is a different product entirely, builtin AVP-governance posting 404. Net effect: **raw practitioner forum voice is the run's biggest blind spot.**
- **Saturation:** by the final third of searches, new queries returned already-fingerprinted sources (hx/Earnix stats recirculated by trade press); stopped there.

## 10. Open questions (ranked, with validation method)

1. How do charts/diagnostics/exact values actually travel into pricing- and reserve-committee decisions today (export formats, screenshot culture, traceability)? → **observation/artifact review** of real committee packs. (Biggest inference gap; directly load-bearing for Prediction Lab's review-workflow bet.)
2. What are actual, current fill-in/build/deployment times measured without vendor sponsorship? → **independent survey or telemetry**; SOA/CAS venues.
3. Does Prediction Lab have production customers, and what happens in their first model cycle (the "pays for itself" claim)? → **interviews/case-study requests; procurement references.**
4. How will state examiners treat AI-agent-run experiments under AIS-program third-party oversight (S14) — what logging/attribution do they require in practice? → **regulatory artifact review of the 2026 12-state pilot outputs.**
5. Which segment does Prediction Lab actually fit: P&C pricing GLM/ML (evidence-aligned) vs heavy life projection compute (no evidence of fit)? → **product inspection/demo.**
6. What do satisfied incumbent users value (stability, validation history, regulator familiarity) that a challenger would lose? → **interviews** — invisible in this run's sources by construction (F14).

## 11. Self-check

- Every factual claim above carries source IDs; inference and hypothesis are labeled (notably §6 item 3 and the §3 strategy inference).
- Prediction Lab claims are dated (changelog versions + access date 2026-08-07).
- Vendor claims (S01–S04, S09–S12, S21, S23) are never presented as user evidence; the three headline pain statistics are explicitly flagged vendor-fingerprinted.
- Shared fingerprints marked (S09=S10; CASTF; NAIC-AIB; CAS tech survey via Coherent).
- Findings carry run-local IDs (R01-F01…F14) and can merge without losing provenance.
- Blind run: no prior campaign reports, syntheses, or the sibling design skill's findings were opened.

---

Report done. Blind pass, 25-source ledger, 14 atomic findings. Biggest evidence gaps: live practitioner forums unreachable + zero independent Prediction Lab customer evidence — both flagged in report, not papered over.