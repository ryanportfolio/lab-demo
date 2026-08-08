import type { AgentAction } from './api';

interface Props {
  actions: AgentAction[];
  onSelectExperiment?: (code: string) => void;
  /** review context: open by default and framed as the sign-off record */
  review?: boolean;
}

const kindLabel: Record<AgentAction['kind'], string> = {
  read: 'Read',
  change: 'Change',
  fit: 'Fit',
  refuse: 'Refused',
  revert: 'Reverted',
  handoff: 'Handoff',
  approve: 'Approve',
};

const statusText = (action: AgentAction) => {
  if (action.kind === 'refuse') return 'Refused';
  if (action.kind === 'revert') return 'Reverted';
  if (!action.reversible) return 'Irreversible · human';
  return 'Applied · reversible';
};

export default function AgentActionLog({ actions, onSelectExperiment, review }: Props) {
  const refused = actions.filter((action) => action.kind === 'refuse').length;
  const reverted = actions.filter((action) => action.kind === 'revert').length;

  return (
    <section className="agent-record" aria-labelledby="agent-record-heading">
      <details open={review || undefined}>
        <summary>
          <span className="workspace-heading">
            <span>
              <span className="eyebrow">Bounded delegation</span>
              <h2 id="agent-record-heading">Agent record</h2>
            </span>
            <span className="section-count">
              {actions.length === 0
                ? 'no record'
                : `${actions.length} actions · ${refused} refused · ${reverted} reverted`}
            </span>
          </span>
        </summary>
        {actions.length === 0 ? (
          <p className="agent-record-empty">
            No action record. This run predates action capture; replay the run to record one.
          </p>
        ) : (
          <ol className="agent-record-list">
            {actions.map((action) => (
              <li
                key={action.seq}
                className={`act-row act-${action.kind} act-${action.actor}`}
              >
                <span className="act-seq">{action.seq}</span>
                <span className={`act-actor ${action.actor}`}>
                  {action.actor === 'human' ? 'Human' : 'AI'}
                </span>
                <span className="act-body">
                  <span className="act-head">
                    <b>{kindLabel[action.kind]}</b>
                    <span className="act-target">
                      {action.experimentCode && onSelectExperiment ? (
                        <button
                          type="button"
                          onClick={() => onSelectExperiment(action.experimentCode!)}
                        >
                          {action.target}
                        </button>
                      ) : (
                        action.target
                      )}
                    </span>
                    <i className={`act-status s-${action.kind === 'approve' ? 'human' : action.kind}`}>
                      {statusText(action)}
                    </i>
                  </span>
                  <span className="act-detail">{action.detail}</span>
                  {action.beforeState && action.afterState && (
                    <span className="act-diff">
                      <del>{action.beforeState}</del>
                      <i aria-hidden="true">→</i>
                      <ins>{action.afterState}</ins>
                    </span>
                  )}
                  {action.refusalReason && (
                    <span className="act-refusal" role="note">
                      {action.refusalReason}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
        {review && actions.length > 0 && (
          <p className="agent-record-note">
            The record above is the run's own trail, kept so this decision stays reconstructable
            at sign-off.
          </p>
        )}
      </details>
    </section>
  );
}
