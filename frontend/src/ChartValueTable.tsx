// The chart's exact-value twin. One component, two homes: the card's
// collapsed details block, and the studio full view's side pane where chart
// and table are synchronized views of the same selection. Values are
// first-class evidence: every number a mark encodes is readable, selectable,
// and copyable here, never hover-only.

import { useEffect, useRef } from 'react';
import { fmtVal } from './Chart';
import type { EvidenceChart } from './api';
import {
  isSecondarySeries,
  normalizeSelection,
  type ChartContract,
  type ChartMode,
  type ChartSelection,
} from './chartWorkspace';

export default function ChartValueTable({
  chart,
  contract,
  mode,
  selection,
  onSelectionChange,
  hidden,
  variant,
}: {
  /** the displayed chart (level or change form), same object the plot draws */
  chart: EvidenceChart;
  contract: ChartContract;
  mode: ChartMode;
  selection: ChartSelection | null;
  onSelectionChange?: (selection: ChartSelection | null) => void;
  hidden?: Set<string>;
  /** details = collapsed under the card · pane = studio side table */
  variant: 'details' | 'pane';
}) {
  const xValues = Array.from(
    new Set(chart.series.flatMap((series) => series.points.map((point) => point.x))),
  ).sort((a, b) => a - b);
  const labels = new Map<number, string>();
  chart.series.forEach((series) =>
    series.points.forEach((point) => {
      if (point.label != null && !labels.has(point.x)) labels.set(point.x, point.label);
    }),
  );

  // hidden series leave the table with the chart, so the two views always
  // show the same evidence; the exposure column stays: it is context, not a
  // series a reader compares
  const primary = chart.series.filter(
    (series) => !isSecondarySeries(series) && !(hidden?.has(series.label)),
  );
  const secondary = chart.series.find(isSecondarySeries);
  const secondaryTotal = secondary
    ? secondary.points.reduce((sum, point) => sum + point.y, 0)
    : 0;

  // the Δ column exists only on the level view: on the change view the
  // displayed series already is the delta
  const comparison =
    mode === 'level' && contract.comparison ? contract.comparison : null;
  const baseline = comparison
    ? chart.series.find((series) => series.label === comparison.baseline)
    : undefined;
  const candidate = comparison
    ? chart.series.find((series) => series.label === comparison.candidate)
    : undefined;
  const showDelta = !!(comparison && baseline && candidate);

  const at = (series: EvidenceChart['series'][number], x: number) =>
    series.points.find((point) => Math.abs(point.x - x) < 1e-9);

  const selected = selection ? normalizeSelection(selection) : null;
  const isSelected = (x: number) =>
    !!selected && x >= selected.start && x <= selected.end;

  // chart→table: an externally pinned selection scrolls its row into view
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useEffect(() => {
    if (!selected || variant !== 'pane') return;
    const row = bodyRef.current?.querySelector<HTMLTableRowElement>(
      `tr[data-x="${selected.start}"]`,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [selected?.start, selected?.end, variant]);

  // table→chart: a row press pins the same selection the plot would;
  // Shift extends to a range where the contract allows one
  const pin = (x: number, extend: boolean) => {
    if (!onSelectionChange) return;
    if (extend && contract.range && selection) {
      onSelectionChange({ start: selection.start, end: x });
    } else {
      onSelectionChange({ start: x, end: x });
    }
  };

  const deltaCell = (x: number) => {
    if (!showDelta) return null;
    const base = at(baseline!, x);
    const cand = at(candidate!, x);
    if (!base || !cand) return <td />;
    const value =
      comparison!.change === 'percent'
        ? base.y === 0
          ? 0
          : 100 * (cand.y / base.y - 1)
        : cand.y - base.y;
    const text =
      comparison!.change === 'percent'
        ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
        : `${value >= 0 ? '+' : ''}${fmtVal(value)}`;
    return <td className="delta">{text}</td>;
  };

  const table = (
    <table>
      <thead>
        <tr>
          <th>{chart.xLabel}</th>
          {primary.map((series) => {
            const bandedSeries = series.points.some((point) => point.se != null);
            return (
              <th key={series.label}>
                {series.label}
                {bandedSeries && <small>±2 SE range</small>}
              </th>
            );
          })}
          {showDelta && <th>{comparison!.label}</th>}
          {secondary && <th>{secondary.label}</th>}
        </tr>
      </thead>
      <tbody ref={bodyRef}>
        {xValues.map((x) => (
          <tr
            key={x}
            data-x={x}
            aria-selected={isSelected(x) || undefined}
            className={isSelected(x) ? 'is-selected' : undefined}
          >
            <th scope="row">
              {onSelectionChange ? (
                <button
                  type="button"
                  onClick={(event) => pin(x, event.shiftKey)}
                >
                  {labels.get(x) ?? fmtVal(x)}
                </button>
              ) : (
                (labels.get(x) ?? fmtVal(x))
              )}
            </th>
            {primary.map((series) => {
              const point = at(series, x);
              if (!point) return <td key={series.label} />;
              return (
                <td key={series.label}>
                  {fmtVal(point.y)}
                  {point.se != null && (
                    <small>
                      {fmtVal(point.y * Math.exp(-2 * point.se))} to{' '}
                      {fmtVal(point.y * Math.exp(2 * point.se))}
                    </small>
                  )}
                </td>
              );
            })}
            {deltaCell(x)}
            {secondary &&
              (() => {
                const point = at(secondary, x);
                if (!point) return <td />;
                const share =
                  secondary.label === 'Earned exposure' && secondaryTotal > 0
                    ? ` · ${((100 * point.y) / secondaryTotal).toFixed(1)}%`
                    : '';
                return (
                  <td className="weight">
                    {secondary.label === 'Earned exposure'
                      ? point.y.toLocaleString('en-US', { maximumFractionDigits: 0 })
                      : point.y.toFixed(1)}
                    {share}
                  </td>
                );
              })()}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (variant === 'pane') {
    // The studio pane owns its own scrolling: reusing the card's 220px cap
    // here showed 5 of 73 rows and clipped the delta and exposure columns
    // with no way to reach them.
    return (
      <div
        className="exact-scroll chart-table-scroll"
        role="region"
        aria-label="Exact values"
        tabIndex={0}
      >
        {table}
      </div>
    );
  }
  return (
    <details className="exact-values">
      <summary>Exact values</summary>
      <div className="exact-scroll">{table}</div>
    </details>
  );
}
