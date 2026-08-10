// Ask sessions, kept on this browser only. A thread is one conversation with
// the context expert about one run; the store holds a handful of runs so a
// replayed demo does not grow localStorage forever.

import type { Answer } from './api';

/** An answer plus what the user actually typed and the context that rode along */
export type StoredTurn = Answer & { display?: string; chip?: string };

export interface AskThread {
  id: string;
  runId: string;
  /** the first question asked, so the sessions list reads like a table of contents */
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: StoredTurn[];
}

const KEY = 'plab-ask-threads';
const THREADS_PER_RUN = 12;
const RUNS_KEPT = 6;

type Store = Record<string, AskThread[]>;

function readStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode or quota: sessions simply stop persisting */
  }
}

const newestFirst = (threads: AskThread[]) =>
  [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export function loadThreads(runId: string): AskThread[] {
  return newestFirst(readStore()[runId] ?? []);
}

export function saveThread(thread: AskThread) {
  const store = readStore();
  const threads = store[thread.runId] ?? [];
  store[thread.runId] = newestFirst([
    thread,
    ...threads.filter((item) => item.id !== thread.id),
  ]).slice(0, THREADS_PER_RUN);
  const runs = Object.keys(store);
  if (runs.length > RUNS_KEPT) {
    const latest = (runId: string) => store[runId][0]?.updatedAt ?? '';
    runs
      .sort((a, b) => latest(b).localeCompare(latest(a)))
      .slice(RUNS_KEPT)
      .forEach((runId) => delete store[runId]);
  }
  writeStore(store);
}

export function deleteThread(runId: string, id: string) {
  const store = readStore();
  const remaining = (store[runId] ?? []).filter((item) => item.id !== id);
  if (remaining.length) store[runId] = remaining;
  else delete store[runId];
  writeStore(store);
}

export const newThreadId = () =>
  `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
