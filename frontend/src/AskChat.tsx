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
  /** index of the turn to hold at the top of the transcript, or null */
  const [pin, setPin] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const followups = useRef<HTMLDetailsElement>(null);
  const sessions = useRef<HTMLDivElement>(null);
  const wasFollowupsOpen = useRef(followupsOpen);

  // The session list is a menu, so anywhere else is a way out of it. The
  // toggle sits inside the same box and closes itself, so it is spared here.
  useEffect(() => {
    if (!sessionsOpen) return;
    const away = (event: PointerEvent) => {
      if (!sessions.current?.contains(event.target as Node)) setSessionsOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [sessionsOpen]);

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

  // Holding a turn at the top is not one scroll: an answer's charts and their
  // text lay out over several frames, and each one moves the target. The pin
  // re-applies while the content settles and lets go the moment the reader
  // takes the wheel.
  useEffect(() => {
    if (pin == null) return;
    const el = body.current;
    if (!el) return;
    let frame = 0;
    const apply = () => {
      const turn = el.querySelectorAll<HTMLElement>('.ask-turn')[pin];
      if (!turn) return;
      // A short answer cannot reach the top on its own: the scroll runs out
      // of content first. The panel lends the difference as trailing space,
      // measured from zero so it never compounds turn to turn.
      el.style.paddingBottom = '0px';
      const top = turn.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
      const below = el.scrollHeight - top;
      const shortfall = Math.max(0, el.clientHeight - below - 8);
      if (shortfall > 0) el.style.paddingBottom = `${shortfall}px`;
      el.scrollTo({ top: Math.max(top - 8, 0) });
    };
    const reapply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(apply);
    };
    apply();
    const observer = new ResizeObserver(reapply);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    const release = () => setPin(null);
    el.addEventListener('wheel', release, { passive: true });
    el.addEventListener('touchstart', release, { passive: true });
    const settled = window.setTimeout(release, 1500);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(settled);
      el.removeEventListener('wheel', release);
      el.removeEventListener('touchstart', release);
    };
  }, [pin]);

  // The handoff from one stuck question to the next is the moment a reader can
  // lose their place, so it is drawn rather than left to happen: the held
  // question is marked while it holds, and it fades and lifts as the next one
  // pushes it out, instead of being replaced between two frames.
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const turns = Array.from(el.querySelectorAll<HTMLElement>('.ask-turn'));
      const edge = el.getBoundingClientRect().top;
      turns.forEach((turn, index) => {
        const question = turn.querySelector<HTMLElement>('.ask-row.you');
        if (!question) return;
        const height = question.offsetHeight || 1;
        const offset = turn.getBoundingClientRect().top - edge;
        const next = turns[index + 1];
        const nextOffset = next ? next.getBoundingClientRect().top - edge : Infinity;
        // held once its turn's top passes the edge, until the next turn
        // reaches it
        const held = offset <= 1 && nextOffset > 0;
        // and shoved over the last header's worth of scroll before that
        const shove = nextOffset < height ? 1 - Math.max(nextOffset, 0) / height : 0;
        if (held) question.setAttribute('data-held', 'true');
        else question.removeAttribute('data-held');
        question.style.setProperty('--handoff', shove.toFixed(3));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    el.addEventListener('scroll', schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => {
      el.removeEventListener('scroll', schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [answers, open]);

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
    setPin(null);
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
      // answer: the question is the anchor the answer is read from. The pin
      // holds through the answer's own layout, which lands late.
      setPin(next.length - 1);
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
        <div className="ask-sessions" ref={sessions}>
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
            {/* The question is the band, not a bubble on one: it runs the
                panel's full width and needs no "You" to say whose it is */}
            <div className="ask-row you">
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
