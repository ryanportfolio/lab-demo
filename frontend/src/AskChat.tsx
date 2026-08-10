// The chat core shared by the ⌘K palette and the chart studio's docked rail:
// transcript, composer, suggested questions, and — when a thread key is given —
// sessions persisted on this browser.
//
// It is deterministic and says so: no model is called, every number comes from
// an artifact this run produced, and a question with no artifact behind it
// gets an honest miss.

import { useEffect, useRef, useState } from 'react';
import Chart from './Chart';
import { ask, fetchSuggestedQuestions } from './api';
import type { AgentAsk } from './chartWorkspace';
import {
  deleteThread,
  loadThreads,
  newThreadId,
  saveThread,
  type AskThread,
  type StoredTurn,
} from './askThreads';

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function AskChat({
  runId,
  ready,
  plain,
  open,
  onCite,
  seed = null,
  threadKey = null,
  autoFocus = false,
}: {
  runId: string | null;
  /** the run has finished, so its verdicts and ledger are settled */
  ready: boolean;
  plain: boolean;
  /** whether the surface is on screen; gates focus and seed adoption */
  open: boolean;
  onCite: (code: string) => void;
  /** an ask carried in from a chart selection */
  seed?: AgentAsk | null;
  /** run id to persist sessions under; without it the transcript is ephemeral */
  threadKey?: string | null;
  /** focus the composer whenever the surface opens, seeded or not */
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<AgentAsk | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [threads, setThreads] = useState<AskThread[]>(() =>
    threadKey ? loadThreads(threadKey) : [],
  );
  const [activeId, setActiveId] = useState<string>(
    () => (threadKey ? loadThreads(threadKey)[0]?.id : undefined) ?? newThreadId(),
  );
  const [answers, setAnswers] = useState<StoredTurn[]>(
    () => (threadKey ? loadThreads(threadKey)[0]?.turns : undefined) ?? [],
  );
  const [sessionsOpen, setSessionsOpen] = useState(false);
  // The follow-ups start open and stay however the reader last left them
  const [followupsOpen, setFollowupsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('plab-ask-followups') !== 'closed';
    } catch {
      return true;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const followups = useRef<HTMLDetailsElement>(null);
  const wasFollowupsOpen = useRef(followupsOpen);

  useEffect(() => {
    fetchSuggestedQuestions().then(setSuggested).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (seed) {
      setQ(seed.question);
      setChip(seed);
    } else if (autoFocus) {
      setChip(null);
    }
    if (seed || autoFocus) requestAnimationFrame(() => input.current?.focus());
  }, [seed, open, autoFocus]);

  // Unfolding brings the questions into view rather than growing a panel
  // below the fold: the reader asked to see them, not to go looking
  useEffect(() => {
    const opened = followupsOpen && !wasFollowupsOpen.current;
    wasFollowupsOpen.current = followupsOpen;
    if (!opened) return;
    const el = body.current;
    const panel = followups.current;
    if (!el || !panel) return;
    const hidden = panel.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
    if (hidden > 0) el.scrollTo({ top: el.scrollTop + hidden + 12 });
  }, [followupsOpen]);

  useEffect(() => {
    const field = input.current;
    if (!field || !open) return;
    field.style.height = 'auto';
    const nextHeight = Math.min(field.scrollHeight, 112);
    field.style.height = `${nextHeight}px`;
    field.style.overflowY = field.scrollHeight > 112 ? 'auto' : 'hidden';
  }, [open, q]);

  function persist(turns: StoredTurn[]) {
    if (!threadKey || !turns.length) return;
    const existing = threads.find((thread) => thread.id === activeId);
    const now = new Date().toISOString();
    saveThread({
      id: activeId,
      runId: threadKey,
      title: existing?.title ?? turns[0].display ?? turns[0].question,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      turns,
    });
    setThreads(loadThreads(threadKey));
  }

  /** the lent trailing space belongs to one turn in one thread, not to the panel */
  function dropTrailingSpace() {
    if (body.current) body.current.style.paddingBottom = '';
  }

  function switchTo(thread: AskThread) {
    setActiveId(thread.id);
    setAnswers(thread.turns);
    setSessionsOpen(false);
    setError(null);
    dropTrailingSpace();
  }

  function startNew() {
    if (!answers.length) {
      setSessionsOpen(false);
      return;
    }
    setActiveId(newThreadId());
    setAnswers([]);
    setSessionsOpen(false);
    setError(null);
    dropTrailingSpace();
  }

  function remove(thread: AskThread) {
    if (!threadKey) return;
    deleteThread(threadKey, thread.id);
    const remaining = loadThreads(threadKey);
    setThreads(remaining);
    if (thread.id !== activeId) return;
    const next = remaining[0];
    if (next) {
      setActiveId(next.id);
      setAnswers(next.turns);
    } else {
      setActiveId(newThreadId());
      setAnswers([]);
    }
  }

  async function send(question: string) {
    if (!runId || !ready || !question.trim() || busy) return;
    setBusy(true);
    setError(null);
    // The chip's context always travels with the question. Unedited, the
    // full composed ask goes as-is; edited, the context is appended so a
    // vague follow-up still lands on the right artifact.
    const carried = chip;
    const wire = carried
      ? question.trim() === carried.question
        ? carried.send
        : `${question.trim()} Context: ${carried.context}.`
      : question.trim();
    try {
      const a = await ask(runId, wire);
      const next: StoredTurn[] = [
        ...answers,
        { ...a, display: question.trim(), chip: carried?.context },
      ];
      persist(next);
      setAnswers(next);
      setQ('');
      setChip(null);
      // Land the reader at the top of the new turn, not the bottom of a long
      // answer: the question is the anchor the answer is read from.
      requestAnimationFrame(() => {
        const el = body.current;
        const turns = el?.querySelectorAll<HTMLElement>('.ask-turn');
        const turn = turns?.length ? turns[turns.length - 1] : null;
        if (el && turn) {
          // A short answer cannot reach the top on its own: the scroll runs
          // out of content first. The panel lends the difference as trailing
          // space, measured from zero so it never compounds turn to turn.
          el.style.paddingBottom = '0px';
          const top =
            turn.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
          const below = el.scrollHeight - top;
          const shortfall = Math.max(0, el.clientHeight - below - 8);
          if (shortfall > 0) el.style.paddingBottom = `${shortfall}px`;
          el.scrollTo({ top: Math.max(top - 8, 0) });
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'the question could not be answered');
    } finally {
      setBusy(false);
    }
  }

  // A question already answered leaves the follow-up list; the transcript
  // above is its record
  const asked = new Set(answers.map((a) => a.display ?? a.question));
  const remaining = suggested.filter((s) => !asked.has(s));

  return (
    <>
      {threadKey && (
        <div className="ask-sessions">
          <button
            type="button"
            className="ask-sess-toggle"
            aria-expanded={sessionsOpen}
            onClick={() => {
              if (!sessionsOpen) setThreads(loadThreads(threadKey));
              setSessionsOpen((prev) => !prev);
            }}
          >
            Sessions{threads.length ? ` · ${threads.length}` : ''}
          </button>
          <button
            type="button"
            className="ask-sess-new"
            onClick={startNew}
            disabled={answers.length === 0}
          >
            New session
          </button>
          <span className="ask-sess-note">Saved in this browser only</span>
          {sessionsOpen && (
            <div className="ask-sess-list" aria-label="Saved sessions">
              {threads.length === 0 && (
                <span className="ask-sess-empty">No sessions saved yet</span>
              )}
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  className="ask-sess-item"
                  data-active={thread.id === activeId || undefined}
                >
                  <button type="button" className="ask-sess-open" onClick={() => switchTo(thread)}>
                    <b>{thread.title}</b>
                    <span>
                      {thread.turns.length} {thread.turns.length === 1 ? 'turn' : 'turns'} ·{' '}
                      {timeLabel(thread.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ask-sess-del"
                    aria-label={`Delete session: ${thread.title}`}
                    onClick={() => remove(thread)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="ask-body" ref={body}>
        {answers.length === 0 && (
          <div className="ask-intro">
            <p>
              Answers are composed from this run's artifacts. Every number
              below comes from a fit, a guardrail reading, or the data
              profile this run produced, and each answer shows what it read
            </p>
            {!ready && (
              <p className="ask-wait">
                The run is still working. Verdicts and the ledger are written
                when the last fit finishes, so the questions open then
              </p>
            )}
            <div className="ask-sugg">
              {suggested.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={busy || !ready}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {answers.map((a, i) => (
          <div className="ask-turn" key={i}>
            <div className="ask-row you">
              <span className="who">You</span>
              <div className="bubble">
                {a.display ?? a.question}
                {a.chip && <span className="ask-chip-echo">{a.chip}</span>}
              </div>
            </div>
            <div className="ask-row ai">
              <span className="who">AI</span>
              <div className="bubble">
                {/* The read trace is provenance, not the answer: it folds
                    away by default and opens when the reader wants to audit */}
                <details className="steps">
                  <summary>
                    <span className="steps-chev" aria-hidden="true" />
                    <span className="steps-title">How this was read</span>
                    <span className="steps-count">
                      {a.steps.length} {a.steps.length === 1 ? 'step' : 'steps'}
                    </span>
                  </summary>
                  <div className="steps-list">
                    {a.steps.map((s, k) => (
                      <div className="step" key={k}>
                        <code>{s.tool}</code>
                        <span className="target">{s.target}</span>
                        <span className="ok">{s.status}</span>
                      </div>
                    ))}
                  </div>
                </details>
                {a.paragraphs.map((p, k) => (
                  <p key={k}>{p}</p>
                ))}
                {a.charts.map((c) => (
                  <Chart
                    key={c.kind + c.title}
                    chart={c}
                    plain={plain}
                    // A selection on an answer's chart can be asked about in
                    // place: the composed question and its chip land in this
                    // same composer
                    onAskSelection={(carried) => {
                      setQ(carried.question);
                      setChip(carried);
                      requestAnimationFrame(() => input.current?.focus());
                    }}
                    askSource={a.citations[0]?.code ?? null}
                  />
                ))}
                {a.citations.length > 0 && (
                  <div className="cites">
                    <span>Read from</span>
                    {a.citations.map((c) => (
                      <button key={c.code} onClick={() => onCite(c.code)}>
                        {c.code} · {c.label}
                      </button>
                    ))}
                  </div>
                )}
                {plain && <div className="gloss">{a.gloss}</div>}
              </div>
            </div>
          </div>
        ))}

        {busy && <div className="ask-busy">Reading the run</div>}
        {error && <div className="ask-error">{error}</div>}

        {/* The fold is controlled, not native: the toggle event is queued, so
            a reader who folds and immediately navigates would lose the
            preference the fold was supposed to record */}
        {answers.length > 0 && !busy && remaining.length > 0 && (
          <details className="ask-followups" ref={followups} open={followupsOpen}>
            <summary
              onClick={(e) => {
                e.preventDefault();
                const next = !followupsOpen;
                setFollowupsOpen(next);
                try {
                  localStorage.setItem('plab-ask-followups', next ? 'open' : 'closed');
                } catch {
                  /* private browsing: the choice just does not stick */
                }
              }}
            >
              <span className="steps-chev" aria-hidden="true" />
              <span>Keep going</span>
              <span className="ask-followups-count">{remaining.length}</span>
            </summary>
            <div className="ask-sugg">
              {remaining.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={busy || !ready}>
                  {s}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="ask-foot">
        {chip && (
          <div className="ask-chip" aria-label="Question context">
            <span>Asking about</span>
            <b>{chip.context}</b>
            <button
              type="button"
              aria-label="Drop this context"
              onClick={() => setChip(null)}
            >
              ×
            </button>
          </div>
        )}
        <div className="ask-compose">
          <textarea
            ref={input}
            rows={1}
            wrap="soft"
            value={q}
            disabled={!ready}
            placeholder={
              ready
                ? 'Type a question about this run'
                : 'The run is still working'
            }
            aria-label="Type a question about this run"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey) return;
              e.preventDefault();
              if (q.trim()) send(q);
            }}
          />
          <button
            className="ask-send"
            onClick={() => send(q)}
            disabled={!ready || busy || !q.trim()}
          >
            Ask
          </button>
        </div>
      </div>
    </>
  );
}
