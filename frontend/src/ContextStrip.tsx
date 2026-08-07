import type { DatasetSummary, Run } from './api';
import { fmtGini, fmtThousands } from './format';

interface Props {
  dataset: DatasetSummary | null;
  run: Run | null;
  view: 'console' | 'review';
}

export default function ContextStrip({ dataset, run, view }: Props) {
  const items = [
    {
      label: 'Data',
      value: dataset ? `${fmtThousands(dataset.rows)} policies · fixed seed` : 'Loading portfolio',
      source: dataset
        ? `${fmtThousands(dataset.claims)} claims · ${fmtThousands(Math.round(dataset.exposure))} earned car years`
        : 'Dataset summary',
    },
    {
      label: 'Target',
      value: 'BI claims / earned car year',
      source: dataset ? `Portfolio frequency ${dataset.frequency.toFixed(4)}` : 'Model target definition',
    },
    {
      label: 'Scope',
      value: 'Full synthetic auto book',
      source: dataset ? `Annual mileage missing ${dataset.missingMileagePct.toFixed(1)}%` : 'Active dataset scope',
    },
    {
      label: 'Validate',
      value: '5 folds + 2025 H2 holdout',
      source: 'Run validation plan',
    },
    {
      label: view === 'review' ? 'Review' : 'Baseline',
      value:
        view === 'review'
          ? `v${run?.baseModelVersion ?? 12} → v${(run?.baseModelVersion ?? 12) + 1}`
          : run?.baselineGini != null
            ? `v${run.baseModelVersion} · Gini ${fmtGini(run.baselineGini)}`
            : 'v12 · loading fit',
      source: run ? `${run.branchName} · ${run.status}` : 'Current model run',
    },
  ];

  return (
    <section className="context-strip" aria-label="Active model context">
      {items.map((item) => (
        <div className="context-item" key={item.label} title={item.source}>
          <span className="context-label">{item.label}</span>
          <strong className="context-value">{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
