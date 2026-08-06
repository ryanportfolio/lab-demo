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

export default function AskPanel({
  runId,
  plain,
  open,
  onClose,
  onCite,
}: {
  runId: string | null;
  plain: boolean;
  open: boolean;
  onClose: () => void;
  onCite: (code: string) => void;
}) {
  const [q, setQ] = useState('');
  const [suggested, setSuggested] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSuggestedQuestions().then(setSuggested).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

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
    if (!runId || !question.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const a = await ask(runId, question.trim());
      setAnswers((prev) => [...prev, a]);
      setQ('');
      requestAnimationFrame(() =>
        body.current?.scrollTo({ top: body.current.scrollHeight }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'the question could not be answered');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

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
          <input
            ref={input}
            value={q}
            placeholder="Ask about this run"
            aria-label="Ask about this run"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              // Enter on an empty box goes back to the question list, so a
              // reader is never stuck on one answer
              if (q.trim()) send(q);
              else setAnswers([]);
            }}
          />
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
              <div className="ask-sugg">
                {suggested.map((s) => (
                  <button key={s} onClick={() => send(s)} disabled={busy}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {answers.length > 0 && (
            <button className="ask-back" onClick={() => setAnswers([])}>
              Back to the questions
            </button>
          )}

          {answers.map((a, i) => (
            <div className="ask-turn" key={i}>
              <div className="ask-row you">
                <span className="who">You</span>
                <div className="bubble">{a.question}</div>
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
        </div>

        <div className="ask-foot">
          <span>
            The context expert reads artifacts and draws them. It cannot fit,
            merge, or approve anything
          </span>
          <span className="kbd">
            {answers.length > 0
              ? 'Enter on an empty box for the question list'
              : 'Enter to ask'}
          </span>
        </div>
      </div>
    </div>
  );
}
