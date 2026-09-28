# Master source ledger

Keyed by underlying-source **fingerprint** (the original study/article/artifact), per protocol §2. "Appears in" lists each run's local source IDs — pages repeating one fingerprint are one source. Duplicate appearances across runs are NOT independent corroboration.

## First-party Prediction Lab (one fingerprint family — vendor class only)

| Fingerprint | Canonical URLs | What it is | Appears in | Limitations |
|---|---|---|---|---|
| FP-PL | predictionlab.ai (home, /changelog, /careers, /downloads→WorkOS) | PL marketing, dated release notes v1.19.0–v1.35.0 (2026-02-13→07-16), careers, auth gate. All runs accessed 2026-08-07 | RA S01–S04 · RB S01–S03 · RC S1–S3 · RD S01–S02 | Self-reported; app + trust page (403) + docs unreachable; 4/4 runs = same single source |

## Shared multi-run fingerprints (watch for false convergence)

| Fingerprint | Source | Class | Appears in | Limitations |
|---|---|---|---|---|
| FP-CODY | Cody, "Enhancing Actuarial Model Governance with Version Control and Git," SOA, 2026-02-18 | Professional body, practitioner-authored (FSA, New York Life) | RA S05 · RB S04 · RC S4 | Single author's account; 3/4 runs cite it — count once |
| FP-HX-SOP | hyperexponential State of Pricing survey family (Coleman Parkes fieldwork, n≈350 specialty/commercial UW+actuaries US/UK; 2023, 2024, 2025 editions) | Vendor-commissioned survey (+trade-press relays: Reinsurance News, Insurance Times, Carrier Management) | RA S09+S10 · RB S07+S08 · RC S5+S6 | Sponsor sells the replacement; specialty/London skew; editions share instrument — one family |
| FP-NAIC-AIB | NAIC AI Model Bulletin (Dec 2023) + state-adoption trackers + 12-state AI exam-tool pilot (Jan–Sep 2026), via law/advisory analyses (Kennedys, Fenwick, Quarles, Plante Moran) | Regulatory (secondary analyses) | RA S14 · RC S10 | Secondary reporting of primary bulletin |
| FP-ASOP56 | ASOP No. 56 "Modeling" (effective 2020-10), ASB text + practice notes | Professional standard | RB S12 · RC S11 | RB reached it snippet-level; RC fetched primary PDF |
| FP-AKUR8-NAIC | Akur8 GLM Methodology & Regulatory Review, NAIC call materials, 2022-05-24 | Regulator-hosted artifact | RC S17 · RD S06(part) | — |
| FP-AKUR8-MKT | Akur8 marketing (10x faster, hours-vs-months; triangles-on-demand; Arius pages) | Vendor | RA S11 · RC S12 · RD S06(part) | Unverified performance claims |
| FP-AKUR8-ARIUS-PR | Akur8–Arius acquisition press (2024-09, GlobeNewswire syndication) | Press | RB S13 · (RC S12 product pages corroborate) | Syndicated copies = one source |
| FP-PROPHET-JOBS | Prophet/AXIS specialist job postings (Pacific Life "Senior Actuary (FSA) – Prophet Modeler" $163–200k; builtin/ziprecruiter/ipsgroup postings; AXIS "versioning methodology" duty) | Implementation artifacts (multiple employers → genuinely plural within class) | RA S20 · RB S14 · RC S16 · RD S13 | Postings describe desired skills, not observed workflow |
| FP-FIS-SCALE | FIS Prophet scale stats (9,000 users/730 sites businesswire 2020; 10,000/1,000/70 product pages) + "50,000 scenarios by tomorrow morning" framing | Vendor | RA S21 · RD S07 | Marketing; two snapshots of same stat family |
| FP-NESTED-SOA | SOA nested-stochastic/runtime corpus (Feng 2016; 2021; 2023; Koernig 2026-06 tail-only runs) | Professional body research | RA S18 · RB S11 | Some landing-page/snippet-level access |
| FP-DATAIKU | Dataiku "modernizing the actuarial workflow" blog | Vendor (competitor commentary on Emblem/Radar) | RB S10 · RD S03 | Snippet-only in both runs — quotes unconfirmed |

## Single-run fingerprints (unique contributions)

| Fingerprint | Source | Class | Run | Used for |
|---|---|---|---|---|
| FP-OW2021 | Jeorgesen & Strother / Oliver Wyman life-modeling survey (40+ companies), SOA 2021-11-17 | Consultancy survey via professional body | RB S05 | CAN-08, CAN-09, CAN-10 (88% scenario cuts, >50% operating time, 90% grid) |
| FP-SOA-MP-2020 | SOA Modeling Platform newsletter Nov 2020 (+2021-09 conversion article) | Professional body | RC S9 | CAN-08 (simplify-to-meet-schedule) |
| FP-FARMER-2025 | Farmer/Grote/Prazak/Wallen, "Optimizing Open System Actuarial Models," SOA 2025-09-16 | Professional body, practitioner-authored | RA S19 | CAN-08 (85%/90% optimization craft) |
| FP-MILLIMAN-ARIUS | Milliman Arius Enterprise case study (anonymous large insurer; 800 h/quarter) | Vendor case study | RC S8 | CAN-10 |
| FP-GIRO-DQ-2008 | "Actuarial I.Q.," CAS E-Forum Winter 2008 (GIRO Data Quality WP survey) | Professional body | RD S09 | CAN-10 (~25% time; dated) |
| FP-PRYOR-2006 | Pryor et al. 2006 GIRO survey (98% Excel), embedded in Gan, Annals of Actuarial Science editorial (online 2025-12-12) | Academic (editorial carrying survey) | RB S06 | CAN-06, CAN-16 |
| FP-IFOA-2006 | "Actuaries excel: but what about their software?" IFoA ~2006 | Professional body | RD S12 | CAN-06 longevity only |
| FP-ROBIDOUX | Robidoux, "Excel is not the culprit," The Actuary Magazine 2021-07 | Practitioner article | RA S15 | CAN-17 (sole source) |
| FP-CHAINLADDER | chainladder-python (CAS GitHub) + CAS E-Forum guide + Hsu & Fannin, Actuarial Review 2024-02-29 | Code artifacts + professional body | RA S16+S17 | CAN-16 |
| FP-CAS-TECH-SVY | CAS First Annual Technology Survey (>80% time barrier), relayed by Coherent vendor blog | Survey via vendor relay | RA S23 | CAN-16 tension |
| FP-EARNIX | Earnix survey PRs (2024): 4-mo median rate change; 58%>5mo | Vendor-commissioned | RA S12 | CAN-11 |
| FP-WTW-SVY-2026 | WTW Advanced Analytics & AI survey (59 P&C insurers), 2026-03 | Vendor-adjacent survey | RA S07 | CAN-11 (IT bottleneck); 429-blocked, snippet-level |
| FP-WTW-RADAR-PR | WTW Radar/Guidewire PR 2025-02-06 ("minutes rather than days, weeks, or months") | Vendor press (syndicated) | RD S08 | CAN-11 negative-space |
| FP-WTW-MPI | WTW/MPI Radar customer story 2023-08 ("user-friendly") | Vendor customer story | RB S09 | CAN-22 |
| FP-G2-RADARLIVE | G2 Radar Live reviews ("fast and painless" deployment) | User reviews (small n) | RC S15 | CAN-22 (challenges CAN-11) |
| FP-G2-AXIS | G2 Moody's AXIS review (closed-system consistency praise) | User reviews (n≈1, snippet) | RD S15 | CAN-22 |
| FP-GOACTUARY-1 | GoActuary thread post (user "Tiffany," 2020-10-26): job offer lost to Prophet experience | Direct practitioner forum evidence — the only one in the campaign | RD S14 | CAN-15 |
| FP-HX-AVIVA | hx/Aviva customer story (20–30 min tool-open times; syndicated) | Vendor customer story | RD S04 | CAN-06 |
| FP-HX-BLOG | hx blogs (Excel alternatives; 1.5M cells/65k formulas; 70/30 time split; Excel-reviewability concession) | Vendor content marketing | RB S16 · RC S7 · RD S05 | CAN-06, CAN-10, CAN-22; mostly snippet-level |
| FP-GUIDEWIRE | Guidewire "hand-offs to unified platform" blog | Vendor | RC S13 | CAN-11 |
| FP-FINTECHGLOBAL | fintech.global "pricing models fail before market," 2026-07-06 | Trade press (likely vendor-sourced) | RC S14 | CAN-11 |
| FP-BURNINGCOST | Burning Cost blog 2026-04-05 citing PRA SS1/23 + FCA TR24/2 | Practitioner-adjacent blog (authorship unverified; regulatory quotes second-hand) | RD S11 | CAN-19 (sole source) |
| FP-AAA-PN-2017 | American Academy of Actuaries Model Governance practice note, 2017-04 | Professional body | RD S10 | CAN-19 support |
| FP-CASTF-WP | NAIC CASTF Predictive Model White Paper (2019) + Model Review Manual (adopted 2025-11-04) | Regulatory primary | RA S13 | CAN-18 |
| FP-FASTCLOSE-2015 | ROC/TORP Working Party "Fast Close," BAJ 20(3), 2015 | Professional body | RA S08 | Reserving time pressure (context) |
| FP-KESTER | Kester, "6 Top Dangers of Actuarial Spreadsheets" (~2015) | Practitioner article (snippet-only) | RA S22 | CAN-06 |
| FP-SOA-GOV-2017 | SOA/Deloitte model governance survey 2017 | Professional body | RA S06 | Landing page only — existence cited |
| FP-SOA-CLOUD-2019 | SOA Cloud Computing & ML report 2019 | Professional body | RA S24 | PDF unreadable — existence only |
| FP-SEO-LISTS | wifitalents/devopsschool/guideflow "best actuarial software" listicles | SEO aggregators (low trust) | RD S16 | Market map names only; not evidence |
| FP-ACCESS-NEG | Dead/blocked channels: Actuarial Outpost (404), Reddit (fetch-refused ×4 runs), GoActuary (JS-gated), acted.co.uk (empty), web.archive.org (blocked), trust.predictionlab.ai (403), Capterra Radar (wrong product) | Negative/access evidence | RA S25 + all runs' §9 | CAN-23 |

## Duplicate-counting rules applied

- FP-PL cited by 4/4 runs → still **one** source for every Prediction Lab claim.
- FP-CODY (3 runs) and FP-HX-SOP (3 runs) are the two most re-reached fingerprints; convergence-matrix counts them once each.
- Trade-press relays (Reinsurance News, Insurance Times, Carrier Management, syndicated PRs) inherit their underlying fingerprint and were never counted separately.
- Job postings are the one class where multiple appearances are genuinely plural (different employers = different underlying artifacts).
