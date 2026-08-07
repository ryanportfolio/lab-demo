# Independent research report schema

Use this structure so reports from different models remain comparable. Adapt prose length, but preserve fields and IDs.

## 1. Run metadata

- Campaign ID and run ID
- Campaign directory and exact report path
- Storage type: caller-supplied shared path | user Desktop | repository fallback
- Persistence or cross-worktree limitation, if any
- Completion time in UTC ISO format; filename uses file-safe `YYYY-MM-DDTHH-mm-ssZ`
- Date and access window
- Model/agent, if known
- Blind, non-blind, or contaminated; explain contamination
- Assigned lens, products, personas, geography, and workflow stages
- Sources reached, source classes missing, and important limitations

## 2. Executive synthesis

- Strongest findings
- Most consequential latent problem
- Strongest contradiction or negative evidence
- Highest-value unanswered question

## 3. Prediction Lab: current evidence

Separate:

- Confirmed first-party claims and shipped capabilities
- Reported user or customer outcomes
- Researcher inference about strategy or differentiation
- Unknowns and conflicting signals

Attach source IDs and dates to every current-state claim.

## 4. Workflow map

For each relevant stage record:

`actor → decision/job → input → tool/artifact → friction → workaround → consequence → handoff`

## 5. Atomic findings

Give each finding a run-local ID such as `R07-F03`.

```text
Finding ID:
Canonical claim:
Evidence type: observation | practitioner report | vendor claim | inference | hypothesis | contradiction | negative evidence
Actor/persona:
Workflow stage and decision:
Product(s) and version context:
Observed behavior or artifact:
Workaround or compensating behavior:
User, business, statistical, regulatory, or operational consequence:
Source IDs:
Independent source classes:
Evidence supporting:
Evidence challenging:
Confidence: strong | moderate | tentative | contested
Why confidence has this level:
Prediction Lab relevance:
Design question or requirement, if supported:
Open validation need:
```

Keep findings atomic. Split claims that have different actors, causes, consequences, or evidence.

## 6. Latent-problem analysis

For each inferred latent problem show the full chain:

`observable behavior → normalized workaround → inferred unmet need → downstream cost → alternative explanations → validation method`

## 7. Contradictions, outliers, and absences

Record credible disagreement, minority workflows, missing populations, claims not supported after searching, and evidence that challenges the dominant story.

## 8. Source ledger

Give every source a stable run-local ID.

```text
Source ID:
Canonical URL:
Title and publisher/author:
Published/updated date and accessed date:
Source class:
Product/version/persona context:
Underlying-source fingerprint:
Evidence used:
Claims supported or challenged:
Commercial, selection, recency, or access limitations:
```

The fingerprint identifies the original study, interview, talk, customer story, document, or dataset even when several pages repeat it.

## 9. Search log and coverage

- Major queries and repositories/sites searched
- Source classes and lenses covered
- Failed or blocked searches that matter
- Where additional searching stopped producing new strong evidence

## 10. Open questions

Rank unresolved questions and name the best validation method: observation, artifact review, interview, support analysis, telemetry, usability test, or additional desk research.

## 11. Self-check

- Every factual claim has a matching source ID.
- Every inference is labeled.
- Current product claims include dates.
- Vendor claims are not treated as user evidence.
- Shared underlying sources are fingerprinted.
- Findings can be merged without losing their original IDs.
- The report contains no conclusions copied from earlier research.
- The complete report was saved, and the exact absolute path was returned.
