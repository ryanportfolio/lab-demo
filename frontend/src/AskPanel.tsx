// The ⌘K palette: a floating dialog around the shared AskChat core. The
// transcript survives close/reopen because the surface stays mounted and is
// hidden with the `hidden` attribute instead of being unmounted.

import { useEffect } from 'react';
import AskChat from './AskChat';
import type { AgentAsk } from './chartWorkspace';

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

  return (
    <div className="ask-scrim" hidden={!open} onMouseDown={onClose}>
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
        <AskChat
          runId={runId}
          ready={ready}
          plain={plain}
          open={open}
          autoFocus
          seed={seed}
          onCite={(code) => {
            onCite(code);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
