import type { Experiment } from './api';
import { fmtDelta } from './format';

interface Props {
  experiments: Experiment[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

const stateLabel = (experiment: Experiment) => {
  if (experiment.status === 'running') return experiment.progress ?? 'Queued';
  if (experiment.status === 'absorbed') return 'Carried into winner';
  return experiment.verdictTag ?? experiment.status;
};

export default function ExperimentLedger({
  experiments,
  selectedCode,
  onSelect,
}: Props) {
  return (
    <section className="experiment-ledger" aria-labelledby="ledger-heading">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">Memory</span>
          <h2 id="ledger-heading">Run ledger</h2>
        </div>
        <span className="section-count">{experiments.filter((e) => e.status !== 'running').length} / 7</span>
      </header>
      <ol>
        {experiments.map((experiment) => {
          const landed = experiment.status !== 'running';
          const selected = selectedCode === experiment.code;
          return (
            <li key={experiment.code}>
              <button
                type="button"
                className={`ledger-row state-${experiment.status}${selected ? ' selected' : ''}`}
                aria-pressed={selected}
                disabled={!landed}
                onClick={() => onSelect(experiment.code)}
              >
                <span className="ledger-code">{experiment.code}</span>
                <span className="ledger-copy">
                  <strong>{experiment.name}</strong>
                  <span>{landed ? experiment.verdictText : experiment.progress ?? 'Queued'}</span>
                </span>
                <span className="ledger-result">
                  <b>{experiment.deltaGini == null ? (landed ? 'not fit' : '…') : fmtDelta(experiment.deltaGini)}</b>
                  <span data-state={experiment.status}>
                    <i aria-hidden="true" />
                    {stateLabel(experiment)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
