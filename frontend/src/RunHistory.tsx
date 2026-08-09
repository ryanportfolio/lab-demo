import { useEffect, useRef, useState } from 'react';
import { fetchRuns, type RunSummary } from './api';
import { fmtDelta } from './format';

interface Props {
  /** breadcrumb text for the current location, e.g. "Run 85" or "Review v13" */
  label: string;
  currentId: string | null;
}

const fate = (run: RunSummary) => {
  if (run.status === 'running') return { text: 'Running', tone: 'live' };
  if (run.status === 'failed') return { text: 'Failed', tone: 'warn' };
  if (run.reviewStatus === 'approved') {
    return run.inForce
      ? { text: `v${run.nextVersion} in force`, tone: 'ok' }
      : { text: 'Replaced', tone: 'muted' };
  }
  if (run.reviewStatus === 'open') return { text: 'Pending review', tone: 'warn' };
  return { text: run.winnerCode ? 'Unreviewed' : 'No winner', tone: 'muted' };
};

export default function RunHistory({ label, currentId }: Props) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState(false);
  const root = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(false);
    fetchRuns()
      .then(setRuns)
      .catch(() => setError(true));
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="run-history" ref={(node) => { root.current = node; }}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Browse all runs"
        onClick={() => setOpen((value) => !value)}
      >
        <b>{label}</b>
        <i aria-hidden="true">{open ? '▴' : '▾'}</i>
      </button>
      {open && (
        <div className="run-history-pop" role="menu" aria-label="All runs">
          <span className="run-history-head">Runs, newest first · the record of every run is kept</span>
          {error && <span className="run-history-empty">Could not load the run list.</span>}
          {!error && !runs && <span className="run-history-empty">Loading runs…</span>}
          {runs?.map((run) => {
            const f = fate(run);
            return (
              <a
                role="menuitem"
                key={run.id}
                href={`/?run=${run.id}`}
                aria-current={run.id === currentId ? 'true' : undefined}
                className={run.id === currentId ? 'current' : undefined}
              >
                <b>Run {run.id}</b>
                <span>
                  {run.winnerCode
                    ? `${run.winnerCode}${run.holdoutDelta != null ? ` · ${fmtDelta(run.holdoutDelta)} holdout` : ''}`
                    : run.status === 'running'
                      ? 'experiments in flight'
                      : 'no winner'}
                </span>
                <small>{new Date(run.startedAtMs).toLocaleString()}</small>
                <i data-tone={f.tone}>{f.text}</i>
              </a>
            );
          })}
        </div>
      )}
    </span>
  );
}
