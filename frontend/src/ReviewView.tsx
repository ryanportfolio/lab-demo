// Review handoff view: the agent's summary, guardrails with how each held,
// the full run ledger, and the human-only approve gate.

import type { Review, Run } from './api';
import EvidencePanel from './EvidencePanel';
import { boldSpans } from './format';

interface Props {
  run: Run;
  review: Review;
  plain: boolean;
  onBack: () => void;
  onApprove: () => void;
  approving: boolean;
  error: string | null;
}

function How({ text }: { text: string }) {
  return (
    <span className="how">
      {boldSpans(text).map((s, i) =>
        typeof s === 'string' ? s : <b key={i}>{s.b}</b>,
      )}
    </span>
  );
}

export default function ReviewView({
  run,
  review,
  plain,
  onBack,
  onApprove,
  approving,
  error,
}: Props) {
  const approved = review.status === 'approved';
  const nextVersion = review.nextVersion;
  const elapsed =
    run.elapsedMs != null ? `${(run.elapsedMs / 1000).toFixed(1)}s` : '';
  const openerLine =
    review.openedBy === 'agent'
      ? 'Review requested by the modeling agent'
      : 'Review opened by the reviewer';

  const dispClass = (disp: string) =>
    disp === 'Winner' ? 'win' : disp === 'Absorbed' ? 'abs' : 'scr';

  return (
    <div>
      <button className="back" onClick={onBack}>
        ← Back to the run
      </button>
      <div className="rv-head">
        <h2>Bodily Injury Frequency</h2>
        <span className="vchip">
          {approved
            ? `v${nextVersion} created`
            : `v${review.baseVersion} → v${nextVersion}`}
        </span>
        <span className={`status${approved ? ' approved' : ''}`}>
          {approved ? 'Approved' : 'Open'}
        </span>
      </div>
      <div className="rv-sub">
        {openerLine} · {review.winnerCode} promoted · {run.counts.spawned}{' '}
        experiments{elapsed ? ` · ${elapsed}` : ''}
      </div>

      <div className="rv-note">
        <div className="byline">
          <span className="ai" aria-hidden="true">
            AI
          </span>
          <span>Modeling agent · run summary</span>
        </div>
        {review.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <div className="gloss">{review.gloss}</div>
      </div>

      <div className="rv-sect">
        <h3>Guardrails, with how each held</h3>
        {review.guardrailRows.map((g) => (
          <div className="gr-row" key={g.what}>
            <span className="mk">✓</span>
            <span className="what">{g.what}</span>
            <How text={g.how} />
          </div>
        ))}
      </div>

      <div className="rv-sect">
        <h3>Run ledger, all {run.counts.spawned} accounted for</h3>
        {review.ledgerRows.map((l) => (
          <div className="led-row" key={l.code}>
            <span className="lid">{l.code}</span>
            <span className={`disp ${dispClass(l.disp)}`}>{l.disp}</span>
            <span className="why">{l.why}</span>
          </div>
        ))}
      </div>

      <div className="rv-sect">
        <h3>
          The model diff: {review.winnerCode} against v{review.baseVersion},
          drawn from the run's artifacts
        </h3>
        <EvidencePanel runId={run.id} code={review.winnerCode} plain={plain} />
      </div>

      <div className="rv-approve">
        <span className="txt">
          {approved
            ? `v${nextVersion} is created and the run ledger is recorded against it.`
            : `Approving merges the branch as v${nextVersion} and records the run ledger against it. The agent can open this review, it cannot approve it.`}
        </span>
        {approved ? (
          <span className="stamp" tabIndex={-1} id="rvStamp">
            v{nextVersion} created just now
          </span>
        ) : (
          <button onClick={onApprove} disabled={approving}>
            Approve and create v{nextVersion}
          </button>
        )}
      </div>
      {error && (
        <div className="banner" role="alert" style={{ marginTop: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}
