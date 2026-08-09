import { useEffect, useState } from 'react';
import type { Review, Run } from './api';
import AgentActionLog from './AgentActionLog';
import EvidencePanel from './EvidencePanel';
import { boldSpans, fmtDelta, fmtGini } from './format';
import type { AgentAsk, SavedChartEvidence } from './chartWorkspace';

interface Props {
  run: Run;
  review: Review;
  plain: boolean;
  onBack: () => void;
  onApprove: () => void;
  approving: boolean;
  error: string | null;
  savedEvidence: SavedChartEvidence[];
  onAsk: (ask: AgentAsk) => void;
  onSave: (evidence: SavedChartEvidence) => void;
}

function How({ text }: { text: string }) {
  return (
    <span className="how">
      {boldSpans(text).map((span, index) =>
        typeof span === 'string' ? span : <b key={index}>{span.b}</b>,
      )}
    </span>
  );
}

const guardrailValue = (text: string) => text.match(/\*\*(.+?)\*\*/)?.[1] ?? 'Held';

export default function ReviewView({
  run,
  review,
  plain,
  onBack,
  onApprove,
  approving,
  error,
  savedEvidence,
  onAsk,
  onSave,
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [weakFocusNonce, setWeakFocusNonce] = useState(0);
  const approved = review.status === 'approved';
  const winner = run.experiments.find((experiment) => experiment.code === review.winnerCode);
  const weakPoint = review.paragraphs.find((paragraph) => /exposure/i.test(paragraph));
  const weakValue = weakPoint?.match(/(\d+(?:\.\d+)?)%/)?.[1];
  const relevantSaved = savedEvidence.filter((item) => item.runId === run.id);

  useEffect(() => setAcknowledged(false), [review.id]);

  const dispositionClass = (disposition: string) =>
    disposition === 'Winner' ? 'win' : disposition === 'Absorbed' ? 'abs' : 'scr';

  return (
    <main className="review-workspace" id="workspace-main">
      <header className="review-head">
        <div>
          <button className="back" type="button" onClick={onBack}>← Run {run.id}</button>
          <span className="eyebrow">Human decision package</span>
          <h1>Bodily Injury Frequency</h1>
        </div>
        <div className="review-version">
          <span>v{review.baseVersion}</span>
          <i aria-hidden="true">→</i>
          <strong>v{review.nextVersion}</strong>
          <b className={`status${approved ? ' approved' : ''}`}>
            {approved ? 'Approved' : 'Pending'}
          </b>
          {approved && review.resultStatus && review.resultStatus !== 'active' && (
            <b className="status superseded">
              {review.resultStatus === 'retired' ? 'Retired by a later replay' : 'Superseded'}
            </b>
          )}
        </div>
      </header>

      {approved && review.resultStatus && review.resultStatus !== 'active' && (
        <section className="as-approved" aria-label="Decision as approved">
          <span className="eyebrow">As approved · frozen at sign-off</span>
          {review.package ? (
            <p>
              {review.package.winnerCode} created v{review.package.newVersion} from v
              {review.package.baseVersion} ({fmtDelta(review.package.trainDelta)} train,{' '}
              {fmtDelta(review.package.holdoutDelta)} holdout) with{' '}
              {review.package.guardrailsHeld} guardrails held and{' '}
              {review.package.actionsTotal} agent actions ({review.package.actionsRefused}{' '}
              refused). Weakest point at sign-off: {review.package.weakestPoint}
              {review.approvedAtMs
                ? ` · approved ${new Date(review.approvedAtMs).toLocaleDateString()}`
                : ''}
            </p>
          ) : (
            <p>
              This approval was recorded before decision-time snapshots existed; only the live
              tables below remain.
            </p>
          )}
        </section>
      )}

      <section className="review-metrics" aria-label="Decision metrics">
        <div><span>Gini</span><strong>{fmtGini(run.baselineGini ?? 0)} → {fmtGini(winner?.gini ?? 0)}</strong></div>
        <div><span>Train</span><strong>{fmtDelta(review.trainDelta)}</strong></div>
        <div><span>Holdout</span><strong>{fmtDelta(review.holdoutDelta)}</strong></div>
        <div><span>Guardrails</span><strong>{review.guardrailRows.length} / {review.guardrailRows.length}</strong></div>
        <div><span>Ledger</span><strong>{review.ledgerRows.length} / {run.counts.spawned}</strong></div>
        <div><span>Agent actions</span><strong>{run.actions.length} · {run.actions.filter((action) => action.kind === 'refuse').length} refused</strong></div>
        <div><span>Question → decision</span><strong>{run.elapsedMs != null ? `${(run.elapsedMs / 1000).toFixed(1)}s run` : '—'}</strong></div>
      </section>

      <div className="review-grid">
        <aside className="review-diff" aria-labelledby="diff-heading">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">Material diff</span>
              <h2 id="diff-heading">What changes</h2>
            </div>
          </div>
          <div className="diff-row">
            <span>Driver age</span>
            <del>5 coarse bands</del>
            <ins>Natural cubic spline</ins>
          </div>
          <div className="diff-row">
            <span>Prior accidents</span>
            <del>Absent</del>
            <ins>Count capped at 3</ins>
          </div>
          <div className="diff-row">
            <span>Rating factors</span>
            <del>{run.baselineFactors ?? 9}</del>
            <ins>{(run.baselineFactors ?? 9) + 1}</ins>
          </div>

          <div className="weak-point">
            <span className="eyebrow">Weakest point</span>
            {weakValue && <strong>{weakValue}% exposure</strong>}
            <p>{weakPoint ?? 'The sparse tail needs a human check before approval.'}</p>
            <button
              type="button"
              className="weak-open"
              onClick={() => {
                setWeakFocusNonce((nonce) => nonce + 1);
                const staticFrame =
                  document.documentElement.classList.contains('no-anim') ||
                  matchMedia('(prefers-reduced-motion: reduce)').matches;
                document
                  .querySelector('.review-proof')
                  ?.scrollIntoView({ block: 'start', behavior: staticFrame ? 'auto' : 'smooth' });
              }}
            >
              Open the sparse tail in evidence →
            </button>
          </div>

          <details className="review-ledger">
            <summary>Run ledger · all {review.ledgerRows.length}</summary>
            {review.ledgerRows.map((row) => (
              <div className="led-row" key={row.code}>
                <span className="lid">{row.code}</span>
                <span className={`disp ${dispositionClass(row.disp)}`}>{row.disp}</span>
                <span className="why">{row.why}</span>
              </div>
            ))}
          </details>
        </aside>

        <section className="review-proof" aria-labelledby="proof-heading">
          <div className="workspace-heading review-proof-head">
            <div>
              <span className="eyebrow">Decision evidence</span>
              <h2 id="proof-heading">Does the gain hold</h2>
            </div>
            <span className="review-requested">
              {review.openedBy === 'agent' ? 'Requested by modeling agent' : 'Opened by reviewer'}
            </span>
          </div>
          <EvidencePanel
            runId={run.id}
            code={review.winnerCode}
            plain={plain}
            experiment={winner}
            focused
            onAsk={onAsk}
            onSave={onSave}
            weakFocus={{
              text: weakPoint ?? 'sparse tail exposure',
              nonce: weakFocusNonce,
            }}
          />
        </section>
      </div>

      {relevantSaved.length > 0 && (
        <section className="saved-evidence" aria-labelledby="saved-evidence-heading">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">Local prototype evidence</span>
              <h2 id="saved-evidence-heading">Carried into review</h2>
            </div>
            <span className="section-count">{relevantSaved.length} saved</span>
          </div>
          <div className="saved-evidence-list">
            {relevantSaved.map((item) => (
              <a className="saved-evidence-row" href={item.url} key={item.id}>
                <span><b>{item.code}</b>{item.title}</span>
                <strong>{item.selection}</strong>
                <span>{item.values.join(' · ')}</span>
                <small>{item.weakPoint}</small>
              </a>
            ))}
          </div>
          <p>Stored in this browser for the concept only. Production review evidence would be versioned server-side.</p>
        </section>
      )}

      <section className="guardrail-matrix" aria-labelledby="guardrail-heading">
        <div className="workspace-heading">
          <div>
            <span className="eyebrow">Bounded delegation</span>
            <h2 id="guardrail-heading">Guardrails</h2>
          </div>
          <strong>All held</strong>
        </div>
        <div className="guardrail-grid">
          {review.guardrailRows.map((guardrail) => (
            <details className="guardrail-cell" key={guardrail.what}>
              <summary>
                <i aria-hidden="true">✓</i>
                <span>{guardrail.what}</span>
                <b>{guardrailValue(guardrail.how)}</b>
              </summary>
              <How text={guardrail.how} />
            </details>
          ))}
        </div>
      </section>

      <AgentActionLog actions={run.actions} review />

      <section className="approval-gate" aria-label="Human approval">
        <div>
          <span className="eyebrow">Human-only action</span>
          <strong>
            {approved
              ? `v${review.nextVersion} created with the run ledger attached`
              : `Create v${review.nextVersion} from ${review.winnerCode}`}
          </strong>
          <span>The agent can request review. It cannot approve.</span>
        </div>
        {approved ? (
          <span className="stamp" tabIndex={-1} id="rvStamp">Approved · v{review.nextVersion}</span>
        ) : (
          <div className="approval-actions">
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              I reviewed the sparse tail
            </label>
            <button type="button" onClick={onApprove} disabled={!acknowledged || approving}>
              {approving ? 'Creating version' : `Approve and create v${review.nextVersion}`}
            </button>
          </div>
        )}
      </section>

      {error && <div className="banner" role="alert">{error}</div>}
    </main>
  );
}
