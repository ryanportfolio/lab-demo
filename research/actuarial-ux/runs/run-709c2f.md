---
aggregation-run-key: run-709c2f
origin-branch: claude/researching-actuarial-ux-709c2f
origin-worktree: .claude/worktrees/researching-actuarial-ux-709c2f
origin-session: f4538c3c-e872-4f53-b217-6f94723aaeab
report-delivered: 2026-08-07T17:37:22Z
collected: 2026-08-07
collection-method: extracted verbatim from session transcript (report was returned in-response, never committed; worktree left clean at main tip)
in-session-preamble: "Research done. Sources exhausted at meaningful coverage: first-party Prediction Lab (3 pages), professional-body + academic + regulatory + vendor-survey classes. Direct forum voices (Reddit/GoActuary/Actuarial Outpost) unreachable via index → logged as blind spot. Full report below."
---

# Independent research report — actuarial UX

## 1. Run metadata

- **Campaign ID / run ID:** none supplied by caller → self-assigned `ADHOC-20260807` / `R01`
- **Date / access window:** 2026-08-07, single session
- **Model/agent:** Claude Fable 5 (claude-fable-5), Claude Code session
- **Blindness:** Blind. Did not open prior reports, `prediction-lab-actuarial-ux` findings, or other researchers' notes. Only skill brief + template read. One contamination-adjacent note: repo branch names reveal that Prediction Lab UX work exists in this repo; no content from it was read.
- **Assigned lens:** none → full-problem coverage, emphasis fell naturally on versioning/governance, run-time/production toil, and AI delegation
- **Scope reached:** US/UK, life + P&C, pricing/modeling/reserving. **Missing source classes:** direct unprompted practitioner posts (forums unreachable), product-interior inspection (Prediction Lab app login-gated; incumbent products uninspectable), support-ticket/telemetry data (never public).

## 2. Executive synthesis

- **Strongest finding:** actuarial teams spend the majority of effort *operating* models rather than exercising judgment — over half of surveyed life modeling teams spend more time running processes and preparing results than reviewing and analyzing them (S05), and version control is still done by file-naming conventions and "changelog tabs" inside spreadsheets (S04). This is corroborated across professional-body, academic, and vendor classes.
- **Most consequential latent problem:** run-time scarcity is silently traded for statistical accuracy. Teams routinely cut stochastic scenario sets by ~88% to make runs finish (S05), and 90% have considered buying grid/cloud compute (S05). Nobody files this as a "complaint" — it is normalized as scenario-reduction methodology.
- **Strongest contradiction:** the loudest dissatisfaction statistics (99% "tech needs improvement", 84% "not future-ready") come from a vendor selling the replacement (hyperexponential, S07/S08). Independent practitioner voices confirming that magnitude were not reachable this run. Meanwhile a WTW customer story calls the same incumbent tooling "user-friendly" (S09). Both directions are commercially motivated.
- **Highest-value unanswered question:** whether Prediction Lab's agent-driven workflow ("AI agents run the full modeling workflow", shipped v1.30.0, 2026-06-10, S02) matches what regulated actuaries can actually accept under ASOP 56's understand-your-model duty (S12) — no independent user evidence exists either way (F05).

## 3. Prediction Lab: current evidence

**Confirmed first-party claims / shipped capabilities** (all first-party; "shipped" = stated in dated release notes, not independently verified):

- Positioning: "Predictive modeling for insurance"; full lifecycle (ingestion → prep → training → deployment); "multi-million record models fit in seconds"; connectors for BigQuery, Snowflake, S3, PostgreSQL, Azure, Google Sheets; external-data marketplace (US Census, NOAA). (S01, accessed 2026-08-07)
- Release cadence: 20 versions listed v1.19.0 (2026-02-13) → v1.35.0 (2026-07-16) — roughly weekly. (S02)
- Governance/collaboration surface: dataset **reviews with field-level diffs** (v1.30.0, 2026-06-10), before/after edit diffs (v1.35.0, 2026-07-16), model-fit comparison with coefficient deltas inside a review (v1.31.0, 2026-06-15), activity feed incl. deletion tracking (v1.33.0), version control + audit trails (S01).
- AI: MCP-server integration "Connect to AI" (v1.29.0, 2026-05-30); "AI agents can run the full modeling workflow" (v1.30.0, 2026-06-10); AI-enhanced reporting "coming soon" (S01, S02).
- Diagnostics/viz: Lorenz curves + Gini (v1.29.0), feature importance (v1.29.0), feature contribution (v1.25.0), distribution tables beside charts (v1.32.0), choropleth/geographic hierarchies (v1.26.0–v1.34.0), dark mode (v1.34.0). (S02)
- Enterprise posture: SOC 2 Type II (v1.23.0, 2026-03-13), single-tenant (v1.19.0), BYOC (v1.20.0), EC2 backend (v1.21.0), trust + status subdomains, DPA/SLA/shared-responsibility legal docs (S01, S02).
- Company: small remote US team; hiring Actuarial Engineer, Design Engineer, ML Engineer, Platform Engineer, Product Engineer (S03, accessed 2026-08-07).

**Reported user/customer outcomes:** none found. No named customers, case studies, funding announcements, or third-party reviews located (F05 — negative evidence).

**Researcher inference (labeled inference):** feature mix (GLM-adjacent diagnostics — Lorenz/Gini, coefficient deltas, feature contribution; geographic rating visuals) suggests P&C pricing as the primary wedge, not life valuation. Deployment options shipped *before* most modeling features suggests enterprise procurement/security was a gating requirement encountered early. Review-diff investment suggests deliberate targeting of the governance/audit gap documented in S04/S12.

**Unknowns / conflicting signals:** actual model classes supported; pricing; customer count; whether "models in seconds" holds at insurer data scale; how agent actions are permissioned/audited; life-side applicability.

## 4. Workflow map

- **Life valuation/projection:** actuary → compute reserves/capital under PBR/LDTI/IFRS17 → admin-system extracts → AXIS/MG-ALFA/Prophet + surrounding spreadsheets → *friction:* manual multi-system data prep, runtimes → *workaround:* scenario reduction (~88%), overnight/grid runs → *consequence:* review time crowded out, accuracy traded → handoff to reporting/audit. (S05, S11)
- **P&C pricing:** pricing actuary → rate adequacy/segmentation → policy+claims data → Excel/Emblem/Radar/Akur8/SAS → *friction:* Excel scale limits (1.5M cells/65k formulas at one insurer, S16-vendor), IT rebuild of actuary prototypes → *workaround:* actuaries keep everything in Excel → *consequence:* operational risk, slow deployment, underwriter buy-in problems (38% cite it, S07-vendor) → handoff to underwriting/filing.
- **Model governance (cross-cutting):** reviewing actuary → approve model/version → model files + docs → shared drives, naming conventions, changelog tabs → *friction:* no authoritative version → *workaround:* `Model_Final_v23.xlsm`-style conventions → *consequence:* audit difficulty, ASOP 56 documentation burden → handoff to auditors/regulators. (S04, S12)

## 5. Atomic findings (condensed to template fields that carry information)

**R01-F01** — Prediction Lab markets a full-lifecycle insurance predictive-modeling platform with speed as the lead claim. *Evidence type:* vendor claim. *Sources:* S01. *Confidence:* strong (that the claim is made), unverified (that it is true). *Relevance:* core positioning.

**R01-F02** — PL ships ~weekly; Feb–Jul 2026 arc ran deployment/compliance → editing flexibility → geo viz → reviews/diffs → AI agents. *Evidence type:* observation (of first-party changelog). *Sources:* S02. *Confidence:* strong for sequence; release notes can overstate substance. *Relevance:* direction signal — governance + AI delegation are current bets.

**R01-F03** — PL shipped "AI agents can run the full modeling workflow" (2026-06-10) and MCP-based assistant integration (2026-05-30); marketing adds "full transparency and control." *Evidence type:* vendor claim. *Sources:* S01, S02. *Confidence:* strong claim exists; zero evidence on real behavior, permissions, refusal, or audit of agent actions. *Design question:* what does an actuary see/approve when an agent has run experiments? *Validation:* product trial, demo recordings.

**R01-F04** — No independent evidence of PL customers, outcomes, funding, or reviews was found after targeted searching. *Evidence type:* negative evidence. *Sources:* search log Q10. *Confidence:* moderate (US-only index; young company). *Relevance:* every capability claim currently rests on vendor sources alone.

**R01-F05** — PL product interior is login-gated (/overview → WorkOS auth); no public docs/manual found. *Evidence type:* observation. *Sources:* S02-access-note. *Consequence:* UX claims cannot be inspected; a source class is structurally missing.

**R01-F06** — Excel is the substrate of actuarial practice: 98% of surveyed GI actuaries used it regularly (Pryor et al. 2006, cited approvingly in a 2026 academic editorial as still-relevant history); professional articles in 2026 still describe spreadsheet-file version management as the norm. *Evidence type:* practitioner survey + professional-body article. *Sources:* S06, S04. *Independent classes:* academic, professional body. *Confidence:* strong. *Relevance:* any challenger must coexist with or replace Excel gravity.

**R01-F07** — Version authority is managed socially, not technically: shared drives, naming conventions ("Model_Final_v23.xlsm"), changelog tabs; uncertainty about which version is authoritative; git named as fix but with CLI learning-curve and legacy-conversion barriers. *Evidence type:* practitioner report (FSA at New York Life, 2026-02-18). *Sources:* S04. *Confidence:* strong (matches S05/S10 indirectly). *PL relevance:* direct — PL's review-diff features target exactly this. *Validation:* interviews on how reviews/approvals actually happen.

**R01-F08** — Over half of life modeling teams spend more time running processes and preparing results than reviewing/analyzing (Oliver Wyman survey, 40+ companies, published SOA 2021-11-17). *Evidence type:* practitioner survey via consultancy. *Sources:* S05. *Confidence:* strong for 2021; staleness risk. *Latent need:* judgment time, not compute features per se.

**R01-F09** — Runtime scarcity is engineered around, not solved: 90% considered grid/cloud; scenario sets cut ~88% (typically to ~1,000 scenarios); runtimes expected to keep growing under PBR/LDTI/IFRS17. *Evidence type:* practitioner survey + professional research. *Sources:* S05, S11. *Confidence:* strong. *Consequence:* accuracy/completeness silently traded for wall-clock. *PL relevance:* "models in seconds" attacks this, but for predictive models, not valuation projections — domain mismatch possible (inference).

**R01-F10** — Front-end data prep is manual: extracts from multiple admin systems, transform effort, before modeling starts. *Evidence type:* practitioner survey. *Sources:* S05. *Confidence:* strong. *PL relevance:* connector + AI-data-prep claims target this (S01, vendor claim).

**R01-F11** — Vendor survey of 350 specialty/commercial underwriters+actuaries (US/UK): 99% say pricing tech needs improvement; 48% cite Excel limitations; 38% of actuaries cite lack of underwriter/business buy-in as barrier to deploying models. *Evidence type:* vendor claim (survey by vendor selling replacement), via trade press. *Sources:* S07, S08. *Confidence:* contested — magnitude unverifiable, selection bias likely. The buy-in finding is the least self-serving and most interesting: model adoption is a cross-role persuasion problem, not just a tooling problem.

**R01-F12** — AI-replacement fear among underwriters/actuaries dropped sharply year-over-year (74%/80% in 2024 → 48%/49% in 2025 per same vendor survey family). *Evidence type:* vendor claim via trade press. *Sources:* S07. *Confidence:* tentative. *Relevance:* softening resistance to AI delegation, but source is invested in that narrative.

**R01-F13** — ASOP 56 (US, effective 2020) requires the actuary to understand model operations, dependencies, sensitivities, and to disclose reliance on models developed by others. *Evidence type:* regulatory/professional standard. *Sources:* S12. *Confidence:* strong. *PL relevance:* an agent-runs-the-workflow product must produce artifacts that let an actuary honestly claim understanding — otherwise professional standards block adoption. *Design requirement (supported):* agent actions need reviewable, explainable, retained traces.

**R01-F14** — Tool expertise is a labor-market category: "Prophet Specialist / Prophet Modeler" job listings; incumbent ecosystems create named-specialist dependence and key-person risk. *Evidence type:* implementation artifact (job listings). *Sources:* S14. *Confidence:* moderate. *Latent problem:* switching cost is people, not licenses.

**R01-F15** — Market is consolidating: Akur8 acquired the Arius reserving tool (announced 2024-09). *Evidence type:* observation (press). *Sources:* S13. *Relevance:* incumbents assembling suites; a point-tool challenger faces suite pressure.

**R01-F16** — One insurer's Excel pricing model: 1.5M populated cells, 65k formulas; manual review "impractical." *Evidence type:* vendor claim (case anecdote). *Sources:* S16. *Confidence:* tentative — unverifiable, selected. Directionally consistent with S04/S06.

**R01-F17** — Academic profession-level trajectory: open-source R/Julia/Python actuarial packages proliferating; stated future = AI + HPC + open source, with "transparency, reproducibility, and collaboration" reshaping validation. *Evidence type:* academic editorial (Annals of Actuarial Science 2026). *Sources:* S06. *Relevance:* a rival substrate to any proprietary platform — sophisticated teams may prefer code.

## 6. Latent-problem analysis

**L1 — Production toil masquerading as actuarial work.** Observable: >50% of time on running/preparing (S05); overnight runs; scenario reduction. Normalized workaround: "model efficiency" techniques as a discipline. Inferred need: iteration speed without accuracy sacrifice, and pipelines that don't need babysitting. Downstream cost: less review → weaker judgment under exactly the regulations demanding more (S11). Alternative explanation: some run-toil is irreducible regulatory volume, not UX failure. Validation: time-on-task telemetry or diary study.

**L2 — Governance by filename.** Observable: naming conventions, changelog tabs, shared drives (S04). Normalized: nobody calls this a product gap; it's "how it's done." Inferred need: native versioning, diffs, approvals bound to the model artifact. Downstream cost: audit pain, ASOP 56 documentation burden, silent overwrite of failed-but-informative work. Alternative explanation: organizational discipline problem solvable by process, not tools. Validation: artifact review of a real team's model directory + interviews.

**L3 — Agent trust gap.** Observable: PL ships agent workflows (S02); fear of AI falling but ~half still fear it (S07); ASOP 56 demands understanding (S12). Inferred need: delegation with reviewable evidence — what ran, why, what changed. Downstream cost if unmet: agents produce output actuaries cannot professionally sign. Alternative explanation: agents used only for low-stakes exploration, gap never binds. Validation: interviews with appointed/signing actuaries; product trial.

**L4 — Cross-role adoption, not modeling, as bottleneck.** Observable: 38% actuaries cite underwriter buy-in as the barrier (S07-vendor). Inferred need: shareable, comprehensible model evidence for non-modelers. Cost: models built but unused ("inaccurate or out of date" per 45% of underwriters, S07). Validation: paired interviews actuary+underwriter.

## 7. Contradictions, outliers, absences

- Dissatisfaction magnitude rests heavily on vendor surveys; independent forums unreachable this run → true pain intensity unconfirmed (selection bias both ways: vendors amplify, satisfied users silent).
- "Radar was user-friendly" (WTW customer story, S09) vs. legacy-tools-are-archaic narrative (S10, vendor) — direct conflict, both commercial.
- Life vs. P&C: most quantitative pain evidence here is life-side (S05); PL's visible features skew P&C pricing (inference) — the strongest documented pain and the product's apparent wedge may not be the same market.
- Absence: no evidence located on how teams *remember failed experiments* (brief Q6) in any incumbent — genuinely unstudied in reachable sources, not just unmet.
- Absence: no independent Prediction Lab user evidence (F04).

## 8. Source ledger

- **S01** — https://www.predictionlab.ai/ — Prediction Lab homepage. Accessed 2026-08-07; © 2026. Class: vendor positioning. Fingerprint: PL-marketing-2026. Limitations: commercial, undated claims.
- **S02** — https://www.predictionlab.ai/changelog (+ ?page=2) — PL release notes v1.19.0 (2026-02-13) → v1.35.0 (2026-07-16). Accessed 2026-08-07. Class: product release notes (first-party). Fingerprint: PL-changelog. Note: /overview auth-gated (WorkOS redirect observed).
- **S03** — https://www.predictionlab.ai/careers — PL careers. Accessed 2026-08-07. Class: implementation artifact / vendor.
- **S04** — https://www.soa.org/communities/emerging-topics/newsletter-articles/2026/february/2026-02-et-cody/ — "Enhancing Actuarial Model Governance with Version Control and Git," Edward Cody FSA CERA (New York Life), SOA, 2026-02-18. Accessed 2026-08-07. Class: professional body / practitioner-authored. Fingerprint: Cody-2026-git.
- **S05** — https://www.soa.org/digital-publishing-platform/emerging-topics/et-2021-11-jeorgensen-strother/ — "A Look Into Current Life Insurance Modeling Programs and Processes," Jeorgesen & Strother, SOA, 2021-11-17. Class: consultancy survey via professional body. Fingerprint: **OliverWyman-life-modeling-survey-2021 (40+ companies)** — any other article citing this survey is the same underlying source. Limitation: 2021 staleness.
- **S06** — doi:10.1017/S1748499525100183 — Gan, "Actuarial software: from tables to high-performance computing," Annals of Actuarial Science 20:210–212, published online 2025-12-12 (2026 issue). Class: academic editorial. Fingerprint: contains **Pryor-et-al-2006-GIRO-survey (98% Excel)** as embedded underlying source. Full PDF read.
- **S07** — https://www.reinsurancene.ws/ai-replacement-fears-fall-sharply-among-underwriters-and-actuaries-hyperexponential/ (+ carriermanagement.com 2025-12-23) — trade-press coverage. Class: vendor survey via trade press. Fingerprint: **hx-State-of-Pricing-2025 (350 specialty/commercial UW+actuaries, US+UK)**. Limitation: vendor sells the replacement; trade press repeats uncritically.
- **S08** — https://www.hyperexponential.com/resources/2025-state-of-pricing-report + https://www.reinsurancene.ws/96-of-underwriters-actuaries-say-pricing-tech-needs-improvement-hyperexponential/ — same fingerprint family as S07 (2024 edition = hx-SoP-2024). Not independently corroborating S07.
- **S09** — https://www.wtwco.com/en-us/news/2023/08/wtw-partners-with-mpi-on-radar-and-emblem-improving-profitability-through-pricing — WTW/MPI customer story, 2023-08. Class: vendor customer story. Limitation: promotional.
- **S10** — https://www.dataiku.com/blog/how-dataiku-is-modernizing-the-actuarial-workflow — Dataiku blog. Class: vendor. **Access limitation: content seen only via search-result summary, not full page — quotes not independently confirmed.**
- **S11** — https://www.soa.org/resources/research-reports/2016/nested-stochastic-modeling/ (Feng, SOA 2016) + https://www.soa.org/digital-publishing-platform/emerging-topics/insights-into-life-pbr/ — SOA research on nested stochastic runtime and PBR practices. Class: professional body. **Access limitation: snippet-level only.**
- **S12** — http://www.actuarialstandardsboard.org/asops/modeling-3/ + Milliman/SOA ASOP 56 practice notes — ASOP No. 56 "Modeling" (effective 2020-10). Class: regulatory/professional standard. Snippet-level + practice-note summaries.
- **S13** — Akur8 acquisition of Arius, announced 2024-09 (press via financialcontent.com syndication of GlobeNewswire). Fingerprint: Akur8-Arius-PR-2024-09. Syndicated copies = one source.
- **S14** — builtin.com job listings ("Senior Actuary – Prophet Specialist," "Prophet Modeler," accessed 2026-08-07). Class: implementation artifact.
- **S16** — https://www.hyperexponential.com/blog/excel-alternatives-insurance-pricing — hx blog (1.5M cells / 65k formulas anecdote). Class: vendor. **Access limitation: search-summary only; direct fetch returned empty body.**

## 9. Search log and coverage

Queries: PL first-party (name search, homepage, changelog ×2, careers, /overview-blocked); "actuarial modeling software frustrations legacy"; Reddit/forum sweeps ×3 (site:reddit.com, r/actuary phrases, goactuary/actuarialoutpost) — **all failed to surface actual threads**; GoActuary Discourse search endpoint returned placeholder (JS-gated); hx State of Pricing; IFoA spreadsheet-risk working party; SOA git article (fetched); Cambridge AAS editorial (fetched as PDF, read locally); nested-stochastic runtime; ASOP 56; PL funding/customers (negative); Akur8/Arius (incidental). Stopping point: last two passes yielded only corroboration or vendor repetition — diminishing returns reached for desk research; the remaining gap (practitioner voice, product interiors) is not desk-reachable.

## 10. Open questions (ranked, with validation method)

1. Do practicing actuaries accept agent-executed modeling under ASOP 56-style duties, and what evidence trail would make sign-off honest? → interviews with signing actuaries + product trial.
2. What is Prediction Lab actually like inside (model classes, agent permissioning, review UX)? → demo/trial, demo recordings, docs access.
3. Is the pain magnitude in vendor surveys real? → independent practitioner interviews or forum ethnography (needs authenticated forum access).
4. How do teams today preserve failed experiments and the "why" behind final models? → artifact review + interviews; no reachable literature found.
5. Does PL's speed claim survive real insurer data + governance constraints? → benchmark trial.
6. Life-side applicability of PL (valuation vs. predictive pricing)? → first-party clarification or trial.

## 11. Self-check

Claims carry source IDs; inferences labeled (F-level and §3); PL claims dated to release versions; vendor claims segregated and flagged (S07/S08/S09/S10/S16); shared underlying sources fingerprinted (OW-2021, hx-SoP-2024/2025, Pryor-2006, Akur8-PR); findings keep run-local IDs for later merge; no prior-report conclusions imported (blind run). Known weaknesses: three sources snippet-level only (S10, S11, S12 partially, S16), practitioner-forum class absent.