// Typed GraphQL client over plain fetch. No client library, no codegen:
// the queries are small and the types are hand-kept.

const API_URL = import.meta.env.VITE_API_URL ?? '/graphql';

export type Role = 'human' | 'agent';

export interface Experiment {
  code: string;
  name: string;
  hypothesis: string;
  wave: number;
  status: 'running' | 'candidate' | 'scrapped' | 'winner' | 'absorbed';
  progress: string | null;
  gini: number | null;
  deltaGini: number | null;
  devianceChangePct: number | null;
  aicDelta: number | null;
  foldsPass: boolean[] | null;
  budgetUsed: number | null;
  verdictTag: string | null;
  verdictText: string | null;
  glossText: string | null;
  lineage: string | null;
}

export interface RailState {
  key: string;
  label: string;
  mark: 'idle' | 'enforced' | 'passed';
  note: string | null;
}

export interface Run {
  id: string;
  goal: string;
  branchName: string;
  status: 'running' | 'complete' | 'failed';
  startedAtMs: number;
  elapsedMs: number | null;
  baselineGini: number | null;
  baselineFactors: number | null;
  trainRows: number | null;
  winnerCode: string | null;
  trainDelta: number | null;
  holdoutDelta: number | null;
  experiments: Experiment[];
  rails: RailState[];
  counts: { spawned: number; landed: number; candidates: number; scrapped: number };
  reviewId: string | null;
  reviewStatus: string | null;
}

export interface GuardrailRow {
  what: string;
  how: string;
}
export interface LedgerRow {
  code: string;
  disp: string;
  why: string;
}

export interface Review {
  id: string;
  runId: string;
  status: 'open' | 'approved';
  openedBy: string;
  winnerCode: string;
  paragraphs: string[];
  gloss: string;
  guardrailRows: GuardrailRow[];
  ledgerRows: LedgerRow[];
  trainDelta: number;
  holdoutDelta: number;
  approvedBy: string | null;
  resultVersion: number | null;
  baseVersion: number;
}

export interface ActiveModel {
  version: number;
  gini: number | null;
  factorCount: number;
}

async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  role: Role = 'human',
): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-actor-role': role,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(body.errors.map((e: { message: string }) => e.message).join('; '));
  }
  return body.data as T;
}

const RUN_FIELDS = `
  id goal branchName status startedAtMs elapsedMs
  baselineGini baselineFactors trainRows winnerCode trainDelta holdoutDelta
  reviewId reviewStatus
  counts { spawned landed candidates scrapped }
  rails { key label mark note }
  experiments {
    code name hypothesis wave status progress gini deltaGini devianceChangePct
    aicDelta foldsPass budgetUsed verdictTag verdictText glossText lineage
  }
`;

const REVIEW_FIELDS = `
  id runId status openedBy winnerCode paragraphs gloss
  guardrailRows { what how }
  ledgerRows { code disp why }
  trainDelta holdoutDelta approvedBy resultVersion baseVersion
`;

export async function fetchLatestRun(): Promise<Run | null> {
  const d = await gql<{ latestRun: Run | null }>(`query { latestRun { ${RUN_FIELDS} } }`);
  return d.latestRun;
}

export async function startRun(): Promise<Run> {
  const d = await gql<{ startRun: Run }>(`mutation { startRun { ${RUN_FIELDS} } }`);
  return d.startRun;
}

export async function fetchReview(runId: string): Promise<Review | null> {
  const d = await gql<{ review: Review | null }>(
    `query($runId: ID!) { review(runId: $runId) { ${REVIEW_FIELDS} } }`,
    { runId },
  );
  return d.review;
}

export async function approveReview(reviewId: string): Promise<number> {
  const d = await gql<{ approveReview: { version: number } }>(
    `mutation($id: ID!) { approveReview(reviewId: $id) { version } }`,
    { id: reviewId },
    'human',
  );
  return d.approveReview.version;
}

export async function fetchActiveModel(): Promise<ActiveModel> {
  const d = await gql<{ activeModel: ActiveModel }>(
    `query { activeModel { version gini factorCount } }`,
  );
  return d.activeModel;
}
