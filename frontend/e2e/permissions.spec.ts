// GraphQL integration test for the run, review, permission flow: the agent
// role can open a review and cannot approve it; the human role can. This
// hits the real API, so it proves the enforcement lives in the GraphQL
// layer, not in hidden buttons.

import { expect, test, type APIRequestContext } from '@playwright/test';

const API = (process.env.PLAB_URL ?? 'http://127.0.0.1:5173') + '/graphql';

async function gql(
  request: APIRequestContext,
  role: 'human' | 'agent',
  query: string,
  variables: Record<string, unknown> = {},
) {
  const res = await request.post(API, {
    headers: { 'content-type': 'application/json', 'x-actor-role': role },
    data: { query, variables },
  });
  return res.json();
}

test('run, review, permission flow', async ({ request }) => {
  test.setTimeout(180_000);

  // start a fresh run (agent role starts runs in this product)
  const started = await gql(
    request,
    'agent',
    'mutation { startRun { id status } }',
  );
  expect(started.errors).toBeUndefined();
  const runId: string = started.data.startRun.id;

  // poll to completion
  let status = 'running';
  for (let i = 0; i < 300 && status === 'running'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const d = await gql(
      request,
      'human',
      'query($id: ID!) { run(id: $id) { status } }',
      { id: runId },
    );
    status = d.data.run.status;
  }
  expect(status).toBe('complete');

  // the agent already opened the review at completion; opening again as
  // agent is idempotent and allowed
  const opened = await gql(
    request,
    'agent',
    'mutation($id: ID!) { openReview(runId: $id) { id status openedBy } }',
    { id: runId },
  );
  expect(opened.errors).toBeUndefined();
  expect(opened.data.openReview.openedBy).toBe('agent');
  const reviewId: string = opened.data.openReview.id;

  // the agent cannot approve: enforced in the resolver, before the database
  const agentApprove = await gql(
    request,
    'agent',
    'mutation($id: ID!) { approveReview(reviewId: $id) { version } }',
    { id: reviewId },
  );
  expect(agentApprove.errors?.[0]?.message).toContain('cannot approve');

  // the human can: v13 exists, v12 superseded, ledger attached via the run
  const humanApprove = await gql(
    request,
    'human',
    'mutation($id: ID!) { approveReview(reviewId: $id) { version status createdByRun } }',
    { id: reviewId },
  );
  expect(humanApprove.errors).toBeUndefined();
  expect(humanApprove.data.approveReview.version).toBeGreaterThan(12);
  expect(humanApprove.data.approveReview.createdByRun).toBe(runId);

  const models = await gql(
    request,
    'human',
    'query { modelVersions { version status } }',
  );
  const list: { version: number; status: string }[] = models.data.modelVersions;
  const newest = list[list.length - 1];
  expect(newest.status).toBe('active');
  const parents = list.filter((m) => m.version < newest.version);
  expect(parents.every((m) => m.status === 'superseded')).toBe(true);
});
