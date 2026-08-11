// The portfolio slice panel: where a promoted chart selection lands. The
// chips are the whole interaction state — every active constraint is a
// visible, removable button, undo walks the history, and the banner says the
// one thing that keeps the slice honest: it filters what you look at, never
// what the model was fitted on. Charts here are observed-only recomputes from
// policy rows; the records table is the bottom of the drill.

import { useEffect, useRef, useState } from 'react';
import {
  fetchPortfolioSlice,
  fetchSliceRecords,
  type SliceRecords,
  type SliceSummary,
} from './api';
import Chart from './Chart';
import { fmtThousands } from './format';
import { serializeFocus, toFilters, type FocusConstraint } from './focus';

const PAGE = 25;

const fmtFreq = (value: number) => value.toFixed(4);

export default function FocusPanel({
  focus,
  onRemove,
  onUndo,
  canUndo,
  onClear,
  onFocus,
  plain,
}: {
  focus: FocusConstraint[];
  onRemove: (field: FocusConstraint['field']) => void;
  onUndo: () => void;
  canUndo: boolean;
  onClear: () => void;
  /** a selection inside a slice chart drills further */
  onFocus: (constraint: FocusConstraint) => void;
  plain: boolean;
}) {
  const [summary, setSummary] = useState<SliceSummary | null>(null);
  const [state, setState] = useState<'loading' | 'refreshing' | 'ready' | 'error'>('loading');
  const [records, setRecords] = useState<SliceRecords | null>(null);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [recordsBusy, setRecordsBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const key = serializeFocus(focus);
  const liveKey = useRef(key);

  useEffect(() => {
    liveKey.current = key;
    if (!focus.length) return;
    // the state contract: keep the last valid slice on screen while the next
    // one loads, and say so, instead of collapsing the layout
    setState((prev) => (summary ? (prev === 'error' ? 'loading' : 'refreshing') : 'loading'));
    setOffset(0);
    setRecords(null);
    fetchPortfolioSlice(toFilters(focus))
      .then((next) => {
        if (liveKey.current !== key) return;
        setSummary(next);
        setState('ready');
      })
      .catch(() => {
        if (liveKey.current !== key) return;
        setState('error');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!recordsOpen || !focus.length) return;
    setRecordsBusy(true);
    const wanted = key;
    fetchSliceRecords(toFilters(focus), offset, PAGE)
      .then((next) => {
        if (liveKey.current !== wanted) return;
        setRecords(next);
      })
      .catch(() => {
        if (liveKey.current !== wanted) return;
        setRecords(null);
      })
      .finally(() => {
        if (liveKey.current === wanted) setRecordsBusy(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsOpen, offset, key]);

  if (!focus.length) return null;

  const versus =
    summary && summary.bookFrequency > 0
      ? summary.frequency / summary.bookFrequency - 1
      : null;

  return (
    <section className="focus-panel" id="portfolio-slice" aria-label="Portfolio slice">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">Portfolio slice</span>
          <h2>Observed experience inside the focus</h2>
        </div>
        <span className="focus-banner">
          Slices filter what you look at · the model stays fitted on the full portfolio
        </span>
      </header>

      <div className="focus-chips" role="group" aria-label="Active slice constraints">
        {focus.map((constraint) => (
          <button
            key={constraint.field}
            type="button"
            className="focus-chip"
            onClick={() => onRemove(constraint.field)}
            title={`Remove ${constraint.label}`}
          >
            <span aria-hidden="true">✕</span> {constraint.label}
          </button>
        ))}
        <button
          type="button"
          className="focus-undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo the last slice change (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button type="button" className="focus-clear" onClick={onClear}>
          Clear slice
        </button>
      </div>

      {state === 'error' ? (
        <div className="evidence-state" role="alert">
          The slice did not load. Remove a chip or retry from the chart.
        </div>
      ) : summary ? (
        <>
          {state === 'refreshing' && (
            <span className="evidence-pending" aria-live="polite">Updating slice</span>
          )}
          <div className="facts" aria-label="Slice totals">
            <span><b>{fmtThousands(summary.rows)}</b> policies</span>
            <span>
              <b>{fmtThousands(Math.round(summary.exposure))}</b> car years
              · {summary.exposureSharePct.toFixed(1)}% of the book
            </span>
            <span><b>{fmtThousands(summary.claims)}</b> claims</span>
            <span>
              frequency <b>{fmtFreq(summary.frequency)}</b>
              {versus != null && (
                <>
                  {' '}· {versus >= 0 ? '+' : ''}
                  {(100 * versus).toFixed(1)}% vs book {fmtFreq(summary.bookFrequency)}
                </>
              )}
            </span>
          </div>

          {summary.rows === 0 ? (
            <div className="evidence-state">
              No policies match this slice. Remove a chip to widen it.
            </div>
          ) : (
            <div className="focus-charts">
              {summary.charts.map((chart) => (
                <Chart
                  key={chart.kind}
                  chart={chart}
                  plain={plain}
                  onFocusSelection={onFocus}
                />
              ))}
            </div>
          )}

          {summary.rows > 0 && (
            <div className="focus-records">
              <button
                type="button"
                className="focus-records-toggle"
                aria-expanded={recordsOpen}
                onClick={() => setRecordsOpen((open) => !open)}
              >
                {recordsOpen ? 'Hide records' : `See records (${fmtThousands(summary.rows)})`}
              </button>
              {recordsOpen && (
                <div className="focus-records-body" aria-busy={recordsBusy}>
                  {records ? (
                    <>
                      <div className="table-scroll">
                        <table className="focus-records-table">
                          <caption className="sr">
                            Policies inside the slice, {fmtThousands(records.total)} total
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Policy</th>
                              <th scope="col">Driver age</th>
                              <th scope="col">Vehicle age</th>
                              <th scope="col">Prior accidents</th>
                              <th scope="col">Territory</th>
                              <th scope="col">Region</th>
                              <th scope="col">Earned exposure</th>
                              <th scope="col">Period</th>
                              <th scope="col">Claims</th>
                            </tr>
                          </thead>
                          <tbody>
                            {records.policies.map((policy) => (
                              <tr key={policy.policyId}>
                                <th scope="row">{policy.policyId}</th>
                                <td>{policy.driverAge}</td>
                                <td>{policy.vehicleAge}</td>
                                <td>{policy.priorAccidents}</td>
                                <td>{policy.territory}</td>
                                <td>{policy.region}</td>
                                <td>{policy.earnedExposure.toFixed(2)}</td>
                                <td>{policy.period}</td>
                                <td>{policy.claimCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="focus-records-pager">
                        <button
                          type="button"
                          onClick={() => setOffset(Math.max(0, offset - PAGE))}
                          disabled={offset === 0 || recordsBusy}
                        >
                          ← Previous
                        </button>
                        <span>
                          {fmtThousands(records.offset + 1)}–
                          {fmtThousands(records.offset + records.policies.length)} of{' '}
                          {fmtThousands(records.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOffset(offset + PAGE)}
                          disabled={offset + PAGE >= records.total || recordsBusy}
                        >
                          Next →
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="evidence-state" aria-busy="true">Reading policy rows</div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="evidence-state" aria-busy="true">Reading the slice</div>
      )}
    </section>
  );
}
