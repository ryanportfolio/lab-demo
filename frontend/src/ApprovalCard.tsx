import { useEffect, useState } from 'react';
import type { Review } from './api';
import { boldSpans, fmtDelta } from './format';

interface Props {
  review: Review;
  runId: string;
  onApprove: () => void;
  approving: boolean;
  error: string | null;
}

/* The human gate is the product's point. It lives in the inspector rail so the
   decision sits beside the evidence instead of below it. Approval appends to
   the decision log and creates the next version; a later run can replace that
   version, but the signed record itself is never unwound. */
export default function ApprovalCard({ review, runId, onApprove, approving, error }: Props) {
  const [acknowledged, setAcknowledged] = useState(false);
  const approved = review.status === 'approved';
  const weakPoint = review.paragraphs.find((paragraph) => /exposure/i.test(paragraph));
  const judgment = review.paragraphs.find((paragraph) => paragraph !== weakPoint);

  useEffect(() => setAcknowledged(false), [review.id]);

  return (
    <section className="approval-gate approval-sheet" aria-label="Human approval">
      <div className="approval-body">
        <strong className="approval-title">
          {approved
            ? `v${review.nextVersion} created with the run ledger attached`
            : `Create v${review.nextVersion} from ${review.winnerCode}`}
        </strong>
        {judgment && (
          <p className="approval-judgment">
            {boldSpans(judgment).map((span, index) =>
              typeof span === 'string' ? span : <b key={index}>{span.b}</b>,
            )}
          </p>
        )}
        <div className="statpair">
          <div>
            <span className="num">{fmtDelta(review.trainDelta)}</span>
            <span className="cap">Train lift · random folds during the run</span>
          </div>
          <div>
            <span className="num">{fmtDelta(review.holdoutDelta)}</span>
            <span className="cap">Holdout lift · out of time, 2025 H2, never fit on</span>
          </div>
        </div>
        <span className="approval-bound">The agent can request review. It cannot approve.</span>
        {!approved && (
          <div className="approval-ack">
            <label>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              I reviewed the sparse tail
            </label>
          </div>
        )}
      </div>
      <div className="approval-foot">
        {approved ? (
          <div className="approval-done">
            <span className="stamp" tabIndex={-1} id="rvStamp">Approved · v{review.nextVersion}</span>
            <a
              className="record-link"
              href={`/record/${runId}`}
              target="_blank"
              rel="noopener"
              title="Standalone copy of this decision, served from the platform's records — printable, works without this app"
            >
              Decision record ↗
            </a>
          </div>
        ) : (
          <div className="approval-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={onApprove}
              disabled={!acknowledged || approving}
            >
              {approving ? 'Creating version' : `Approve and create v${review.nextVersion}`}
            </button>
          </div>
        )}
        {error && <div className="banner" role="alert">{error}</div>}
      </div>
    </section>
  );
}
