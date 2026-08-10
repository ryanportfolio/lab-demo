// The active model context, held in a fixed right inspector rail instead of a
// horizontal strip that scrolls away. Same information, three named groups:
// what the run is fitting, what constrains it, and where the run stands.
// Under 900px the rail collapses back to a compact strip above the workspace.

import type { ReactNode } from 'react';
import type { DatasetSummary, RailState, Run } from './api';
import { fmtGini, fmtThousands } from './format';

/** A guardrail's mark says what the rail did, not which enum the API returned. */
const RAIL_STATUS: Record<RailState['mark'], string> = {
  passed: 'held',
  enforced: 'scrapped an experiment',
  idle: 'no breach yet',
};

interface Props {
  dataset: DatasetSummary | null;
  run: Run | null;
  view: 'console' | 'review';
  /** review-view slot: the approval card rides the rail's empty space */
  children?: ReactNode;
}

interface RailRow {
  key: string;
  value: string;
  /** the strip's source line, kept as the row's provenance on hover */
  source?: string;
  /** declared-constraint state, the only thing in here allowed semantic colour */
  state?: string;
}

export default function ContextStrip({ dataset, run, view, children }: Props) {
  const context: RailRow[] = [
    {
      key: 'Data',
      value: dataset ? `${fmtThousands(dataset.rows)} policies · fixed seed` : 'Loading portfolio',
      source: dataset
        ? `${fmtThousands(dataset.claims)} claims · ${fmtThousands(Math.round(dataset.exposure))} earned car years`
        : 'Dataset summary',
    },
    {
      key: 'Target',
      value: 'BI claims / earned car year',
      source: dataset ? `Portfolio frequency ${dataset.frequency.toFixed(4)}` : 'Model target definition',
    },
    {
      key: 'Scope',
      value: 'Full synthetic auto book',
      source: dataset ? `Annual mileage missing ${dataset.missingMileagePct.toFixed(1)}%` : 'Active dataset scope',
    },
    {
      key: 'Validate',
      value: '5 folds + 2025 H2 holdout',
      source: 'Run validation plan',
    },
  ];

  // Guardrail rows carry the platform's own label; the mark is an API enum, so
  // it drives the state colour but never reaches the page as words. What a
  // reader sees is what the rail did. The note names the experiment a rail
  // scrapped, which is what the strip's title held.
  const guardrails: RailRow[] = (run?.rails ?? []).map((rail) => ({
    key: rail.label,
    value: RAIL_STATUS[rail.mark],
    source: rail.note ?? rail.label,
    state: rail.mark,
  }));

  const runRows: RailRow[] = [
    {
      key: view === 'review' ? 'Review' : 'Baseline',
      value:
        view === 'review'
          ? `v${run?.baseModelVersion ?? 12} → v${(run?.baseModelVersion ?? 12) + 1}`
          : run?.baselineGini != null
            ? `v${run.baseModelVersion} · Gini ${fmtGini(run.baselineGini)}`
            : 'v12 · loading fit',
    },
    { key: 'Branch', value: run?.branchName ?? 'run pending' },
    { key: 'Status', value: run?.status ?? 'loading' },
  ];

  const groups = [
    { label: 'Context', rows: context },
    { label: 'Guardrails', rows: guardrails },
    { label: 'Run', rows: runRows },
  ].filter((group) => group.rows.length > 0);

  return (
    <aside className="context-strip" aria-label="Active model context">
      {groups.map((group) => (
        <div className="rail-group" role="group" aria-label={group.label} key={group.label}>
          <span className="rail-group-label" aria-hidden="true">{group.label}</span>
          <dl className="rail-rows">
            {group.rows.map((row) => (
              <div className="rail-row" key={row.key} title={row.source}>
                <dt className="rail-key">{row.key}</dt>
                <dd className="rail-val" data-state={row.state}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {children}
    </aside>
  );
}
