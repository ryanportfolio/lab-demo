// The context expert. Ask a question about the run, get an answer built from
// the run's own artifacts, with the steps it took and the experiments it read
// shown next to it.
//
// It is deterministic and says so: no model is called, every number comes from
// an artifact this run produced, and a question with no artifact behind it
// gets an honest miss.

import { useEffect, useRef, useState } from 'react';
import Chart from './Chart';
import { ask, fetchSuggestedQuestions, type Answer } from './api';
import type { AgentAsk } from './chartWorkspace';

/** An answer plus what the user actually typed and the context that rode along */
type ShownAnswer = Answer & { display?: string; chip?: string };

export default function AskPanel({
  runId,
  ready,
  plain,
  open,
  onClose,
  onCite,
  seed = null,
}: {
  runId: string | null;
  /** the run has finished, so its verdicts and ledger are settled */
  ready: boolean;
  plain: boolean;
  open: boolean;
  onClose: () => void;
  onCite: (code: string) => void;
  /** an ask carried in from a chart selection */
  seed?: AgentAsk | null;
}) {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<AgentAsk | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [answers, setAnswers] = useState<ShownAnswer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSuggestedQuestions().then(setSuggested).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (seed) {
      setQ(seed.question);
      setChip(seed);
    } else {
      setChip(null);
    }
    requestAnimationFrame(() => input.current?.focus());
  }, [seed, open]);

  useEffect(() => {
    const field = input.current;
    if (!field || !open) return;
    field.style.height = 'auto';
    const nextHeight = Math.min(field.scrollHeight, 112);
    field.style.height = `${nextHeight}px`;
    field.style.overflowY = field.scrollHeight > 112 ? 'auto' : 'hidden';
  }, [open, q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // While the palette is up, the page underneath holds still. Padding for the
  // scrollbar width keeps the layout from jumping as it is taken away.
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const overflow = body.style.overflow;
    const padRight = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padRight;
    };
  }, [open]);

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
      setAnswers((prev) => [
        ...prev,
        { ...a, display: question.trim(), chip: carried?.context },
      ]);
      setQ('');
      setChip(null);
      // Land the reader at the top of the new turn, not the bottom of a long
      // answer: the question is the anchor the answer is read from.
      requestAnimationFrame(() => {
        const el = body.current;
        const turns = el?.querySelectorAll<HTMLElement>('.ask-turn');
        const turn = turns?.length ? turns[turns.length - 1] : null;
        if (el && turn) {
          const top =
            turn.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
          el.scrollTo({ top: Math.max(top - 8, 0) });
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'the question could not be answered');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  // A question already answered leaves the follow-up list; the transcript
  // above is its record
  const asked = new Set(answers.map((a) => a.display ?? a.question));
  const remaining = suggested.filter((s) => !asked.has(s));

  return (
    <div className="ask-scrim" onMouseDown={onClose}>
      <div
        className="ask"
        role="dialog"
        aria-modal="true"
        aria-label="Ask about this run"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ask-bar">
          <span className="ask-mark" aria-hidden="true">
            AI
          </span>
          <h2>Ask about this run</h2>
          <button className="ask-esc" onClick={onClose}>
            Esc
          </button>
        </div>

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
                  <div className="steps">
                    {a.steps.map((s, k) => (
                      <div className="step" key={k}>
                        <code>{s.tool}</code>
                        <span className="target">{s.target}</span>
                        <span className="ok">{s.status}</span>
                      </div>
                    ))}
                  </div>
                  {a.paragraphs.map((p, k) => (
                    <p key={k}>{p}</p>
                  ))}
                  {a.charts.map((c) => (
                    <Chart key={c.kind + c.title} chart={c} plain={plain} />
                  ))}
                  {a.citations.length > 0 && (
                    <div className="cites">
                      <span>Read from</span>
                      {a.citations.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            onCite(c.code);
                            onClose();
                          }}
                        >
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

          {answers.length > 0 && !busy && remaining.length > 0 && (
            <div className="ask-followups">
              <span>Keep going</span>
              <div className="ask-sugg">
                {remaining.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={busy || !ready}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
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
          <span className="ask-note">
            The context expert reads artifacts and draws them. It cannot fit,
            merge, or approve anything
          </span>
        </div>
      </div>
    </div>
  );
}
