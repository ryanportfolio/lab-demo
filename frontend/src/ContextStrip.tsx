// The active model context, held in a fixed right inspector rail instead of a
// horizontal strip that scrolls away.
//
// Its three registers are three different tenses, and each keeps its own row
// shape so a reader can tell them apart without reading: Context is what was
// agreed before the run and cannot move, Guardrails are constraints checked
// while it ran and carry a live verdict, Run is where it stands now. Every
// claim shows its source on the page — the rail used to hide all of it in
// title attributes, including the one fact that says the guardrails were not
// decoration: two of the three stopped a real experiment.
//
// Under 900px the rail collapses back to a compact strip above the workspace.

import type { ReactNode } from 'react';
import type { DatasetSummary, RailState, Run } from './api';
import { fmtGini, fmtThousands } from './format';

/** A guardrail's verdict says what the rail did, not which enum the API
 *  returned. `binding` is a constraint that is stopping work right now; the
 *  cost line beside it names what it stopped. */
const RAIL_VERDICT: Record<RailState['mark'], string> = {
  passed: 'held',
  enforced: 'binding',
  idle: 'no breach',
};

/** The note arrives as platform prose ("enforced, EXP-03 scrapped"). We want
 *  the code out of it to link into that experiment's evidence, but a rail
 *  whose note stops matching this shape still shows its note verbatim. */
const EXP_CODE = /\b(EXP-\d+)\b/;

interface Props {
  dataset: DatasetSummary | null;
  run: Run | null;
  view: 'console' | 'review';
  /** opens a scrapped experiment's evidence, the way the agent record does */
  onSelectExperiment?: (code: string) => void;
  /** review-view slot: the approval card rides the rail's empty space */
  children?: ReactNode;
}

interface EntryRow {
  key: string;
  value: string;
  /** mono is for ids, versions and measures; a definition reads as prose */
  mono?: boolean;
  /** the row's provenance, on the page rather than behind a hover */
  source?: string;
}

function Entries({ rows }: { rows: EntryRow[] }) {
  return (
    <dl className="rail-rows">
      {rows.map((row) => (
        <div className="rail-row" key={row.key}>
          <dt className="rail-key">{row.key}</dt>
          <dd className="rail-val" data-mono={row.mono ? '' : undefined}>{row.value}</dd>
          {row.source && <dd className="rail-source">{row.source}</dd>}
        </div>
      ))}
    </dl>
  );
}

export default function ContextStrip({
  dataset,
  run,
  view,
  onSelectExperiment,
  children,
}: Props) {
  const context: EntryRow[] = [
    {
      key: 'Data',
      value: dataset ? `${fmtThousands(dataset.rows)} policies · fixed seed` : 'Loading portfolio',
      source: dataset
        ? `${fmtThousands(dataset.claims)} claims · ${fmtThousands(Math.round(dataset.exposure))} earned car years`
        : undefined,
    },
    {
      key: 'Target',
      value: 'BI claims / earned car year',
      source: dataset ? `portfolio frequency ${dataset.frequency.toFixed(4)}` : undefined,
    },
    {
      key: 'Scope',
      value: 'Full synthetic auto book',
      // The book's weak point belongs beside its scope, not two panels away.
      source: dataset ? `${dataset.missingMileagePct.toFixed(1)}% missing annual mileage` : undefined,
    },
    {
      key: 'Validate',
      value: '5 folds + 2025 H2 holdout',
      source: run?.trainRows != null ? `${fmtThousands(run.trainRows)} rows fit` : undefined,
    },
  ];

  // The label is the constraint as declared, the mark drives the verdict's
  // colour without ever reaching the page as words, and the note is the cost:
  // the experiment this rail scrapped.
  const guardrails = (run?.rails ?? []).map((rail) => {
    const code = rail.note?.match(EXP_CODE)?.[1] ?? null;
    return {
      key: rail.key,
      clause: rail.label,
      mark: rail.mark,
      verdict: RAIL_VERDICT[rail.mark],
      code,
      // no note means nothing tripped this rail, and the row says so by
      // carrying no cost line at all
      cost: rail.note ?? null,
    };
  });

  const runRows: EntryRow[] = [
    {
      key: view === 'review' ? 'Review' : 'Baseline',
      value:
        view === 'review'
          ? `v${run?.baseModelVersion ?? 12} → v${(run?.baseModelVersion ?? 12) + 1}`
          : run?.baselineGini != null
            ? `v${run.baseModelVersion} · Gini ${fmtGini(run.baselineGini)}`
            : 'v12 · loading fit',
      mono: true,
      source:
        run?.baselineFactors != null ? `${run.baselineFactors} rating factors at v${run.baseModelVersion}` : undefined,
    },
    { key: 'Branch', value: run?.branchName ?? 'run pending', mono: true },
    { key: 'Status', value: run?.status ?? 'loading' },
  ];

  return (
    <aside className="context-strip" aria-label="Active model context">
      {/* In review the rail's job is the decision, so the approval card leads
          and the registers back it up. Read and placed the same way: the
          checkbox that gates Approve must not sit below a scroll. */}
      {children}

      <div className="rail-group" role="group" aria-label="Context">
        <span className="rail-group-label" aria-hidden="true">Context</span>
        <Entries rows={context} />
      </div>

      {guardrails.length > 0 && (
        <div className="rail-group" role="group" aria-label="Guardrails">
          <span className="rail-group-label" aria-hidden="true">Guardrails</span>
          <ul className="rail-checks">
            {guardrails.map((rail) => (
              <li className="rail-check" key={rail.key}>
                <b className="rail-tick" data-state={rail.mark}>{rail.verdict}</b>
                <p className="rail-clause">{rail.clause}</p>
                {rail.cost && (
                  <p className="rail-cost">
                    {rail.code ? (
                      onSelectExperiment ? (
                        <button
                          type="button"
                          onClick={() => onSelectExperiment(rail.code!)}
                          title={`Open ${rail.code} in the evidence panel`}
                        >
                          scrapped {rail.code} ↗
                        </button>
                      ) : (
                        `scrapped ${rail.code}`
                      )
                    ) : (
                      rail.cost
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rail-group" role="group" aria-label="Run">
        <span className="rail-group-label" aria-hidden="true">Run</span>
        <Entries rows={runRows} />
      </div>
    </aside>
  );
}
