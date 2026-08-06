# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: permissions.spec.ts >> run, review, permission flow
- Location: e2e\permissions.spec.ts:23:1

# Error details

```
Error: expect(received).toBeUndefined()

Received: [{"locations": [{"column": 12, "line": 1}], "message": "error occurred while decoding column 6: mismatched types; Rust type `f64` (as SQL type `FLOAT8`) is not compatible with SQL type `NUMERIC`", "path": ["startRun"]}]
```

# Test source

```ts
  1  | // GraphQL integration test for the run, review, permission flow: the agent
  2  | // role can open a review and cannot approve it; the human role can. This
  3  | // hits the real API, so it proves the enforcement lives in the GraphQL
  4  | // layer, not in hidden buttons.
  5  | 
  6  | import { expect, test, type APIRequestContext } from '@playwright/test';
  7  | 
  8  | const API = (process.env.PLAB_URL ?? 'http://127.0.0.1:5173') + '/graphql';
  9  | 
  10 | async function gql(
  11 |   request: APIRequestContext,
  12 |   role: 'human' | 'agent',
  13 |   query: string,
  14 |   variables: Record<string, unknown> = {},
  15 | ) {
  16 |   const res = await request.post(API, {
  17 |     headers: { 'content-type': 'application/json', 'x-actor-role': role },
  18 |     data: { query, variables },
  19 |   });
  20 |   return res.json();
  21 | }
  22 | 
  23 | test('run, review, permission flow', async ({ request }) => {
  24 |   test.setTimeout(180_000);
  25 | 
  26 |   // start a fresh run (agent role starts runs in this product)
  27 |   const started = await gql(
  28 |     request,
  29 |     'agent',
  30 |     'mutation { startRun { id status } }',
  31 |   );
> 32 |   expect(started.errors).toBeUndefined();
     |                          ^ Error: expect(received).toBeUndefined()
  33 |   const runId: string = started.data.startRun.id;
  34 | 
  35 |   // poll to completion
  36 |   let status = 'running';
  37 |   for (let i = 0; i < 300 && status === 'running'; i++) {
  38 |     await new Promise((r) => setTimeout(r, 500));
  39 |     const d = await gql(
  40 |       request,
  41 |       'human',
  42 |       'query($id: ID!) { run(id: $id) { status } }',
  43 |       { id: runId },
  44 |     );
  45 |     status = d.data.run.status;
  46 |   }
  47 |   expect(status).toBe('complete');
  48 | 
  49 |   // the agent already opened the review at completion; opening again as
  50 |   // agent is idempotent and allowed
  51 |   const opened = await gql(
  52 |     request,
  53 |     'agent',
  54 |     'mutation($id: ID!) { openReview(runId: $id) { id status openedBy } }',
  55 |     { id: runId },
  56 |   );
  57 |   expect(opened.errors).toBeUndefined();
  58 |   expect(opened.data.openReview.openedBy).toBe('agent');
  59 |   const reviewId: string = opened.data.openReview.id;
  60 | 
  61 |   // the agent cannot approve: enforced in the resolver, before the database
  62 |   const agentApprove = await gql(
  63 |     request,
  64 |     'agent',
  65 |     'mutation($id: ID!) { approveReview(reviewId: $id) { version } }',
  66 |     { id: reviewId },
  67 |   );
  68 |   expect(agentApprove.errors?.[0]?.message).toContain('cannot approve');
  69 | 
  70 |   // the human can: v13 exists, v12 superseded, ledger attached via the run
  71 |   const humanApprove = await gql(
  72 |     request,
  73 |     'human',
  74 |     'mutation($id: ID!) { approveReview(reviewId: $id) { version status createdByRun } }',
  75 |     { id: reviewId },
  76 |   );
  77 |   expect(humanApprove.errors).toBeUndefined();
  78 |   expect(humanApprove.data.approveReview.version).toBeGreaterThan(12);
  79 |   expect(humanApprove.data.approveReview.createdByRun).toBe(runId);
  80 | 
  81 |   const models = await gql(
  82 |     request,
  83 |     'human',
  84 |     'query { modelVersions { version status } }',
  85 |   );
  86 |   const list: { version: number; status: string }[] = models.data.modelVersions;
  87 |   const newest = list[list.length - 1];
  88 |   expect(newest.status).toBe('active');
  89 |   const parents = list.filter((m) => m.version < newest.version);
  90 |   expect(parents.every((m) => m.status === 'superseded')).toBe(true);
  91 | });
  92 | 
```