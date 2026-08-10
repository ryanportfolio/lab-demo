// The chart's exact-value twin. One component, two homes: the card's
// collapsed details block, and the studio full view's pane, which the reader
// seats beside the plot, under it, or in its stead. Values are first-class
// evidence: every number a mark encodes is readable, selectable, and copyable
// here, never hover-only.

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
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
  source,
  fileBase,
}: {
  /** the displayed chart (level or change form), same object the plot draws */
  chart: EvidenceChart;
  contract: ChartContract;
  mode: ChartMode;
  selection: ChartSelection | null;
  onSelectionChange?: (selection: ChartSelection | null) => void;
  hidden?: Set<string>;
  /** details = collapsed under the card · pane = the studio's placed table */
  variant: 'details' | 'pane';
  /** provenance line leading a copy and a file; falls back to the title */
  source?: string;
  /** file stem for the CSV download; falls back to the chart's own name */
  fileBase?: string;
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

  // chart→table: a pin marks its row and moves nothing. The table used to
  // chase the selection, so pinning a late point threw the table a thousand
  // pixels down while the reader was still looking at the chart. The pinned
  // values are already read out beside the plot; the row is here, marked,
  // whenever the reader comes down for it.

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

  // This is a spreadsheet in every way that matters, so it selects like one:
  // press a cell and sweep a block, Shift extends the block from where it
  // began. The rows a block covers are the chart's selection, so the two
  // views never disagree about what is being read.
  const columnCount = 1 + primary.length + (showDelta ? 1 : 0) + (secondary ? 1 : 0);
  const [range, setRange] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(
    null,
  );
  const anchor = useRef<{ r: number; c: number } | null>(null);
  const dragging = useRef(false);
  // the last selection this table pushed, so the chart's echo of it does not
  // widen the block back out to every column
  const pushed = useRef('');

  const cellAt = (target: Element | null) => {
    const cell = target?.closest('td[data-r], th[data-r]');
    if (!cell) return null;
    return { r: Number(cell.getAttribute('data-r')), c: Number(cell.getAttribute('data-c')) };
  };

  const sweep = (to: { r: number; c: number }) => {
    const from = anchor.current ?? to;
    setRange({
      r1: Math.min(from.r, to.r),
      r2: Math.max(from.r, to.r),
      c1: Math.min(from.c, to.c),
      c2: Math.max(from.c, to.c),
    });
    if (!onSelectionChange) return;
    // a chart that takes no range follows the cell under the pointer instead
    const start = contract.range ? xValues[Math.min(from.r, to.r)] : xValues[to.r];
    const end = contract.range ? xValues[Math.max(from.r, to.r)] : xValues[to.r];
    if (start == null || end == null) return;
    const key = `${start}:${end}`;
    if (key === pushed.current) return;
    pushed.current = key;
    onSelectionChange({ start, end });
  };

  const gridHandlers = {
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.button !== 0) return;
      const cell = cellAt(event.target as Element);
      if (!cell) return;
      // the press is a range gesture, not a text drag
      event.preventDefault();
      dragging.current = true;
      if (!(event.shiftKey && anchor.current)) anchor.current = cell;
      event.currentTarget.setPointerCapture(event.pointerId);
      sweep(cell);
    },
    onPointerMove: (event: ReactPointerEvent) => {
      if (!dragging.current) return;
      const cell = cellAt(document.elementFromPoint(event.clientX, event.clientY));
      if (cell) sweep(cell);
    },
    onPointerUp: (event: ReactPointerEvent) => {
      dragging.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    onPointerCancel: () => {
      dragging.current = false;
    },
  };

  // chart→table: a selection made on the plot lights the same rows, whole width
  useEffect(() => {
    if (dragging.current) return;
    if (!selected) {
      setRange(null);
      pushed.current = '';
      anchor.current = null;
      return;
    }
    const key = `${selected.start}:${selected.end}`;
    if (key === pushed.current) return;
    pushed.current = key;
    const r1 = xValues.findIndex((x) => x >= selected.start);
    let r2 = -1;
    xValues.forEach((x, index) => {
      if (x <= selected.end) r2 = index;
    });
    if (r1 < 0 || r2 < r1) {
      setRange(null);
      return;
    }
    anchor.current = { r: r1, c: 0 };
    setRange({ r1, r2, c1: 0, c2: columnCount - 1 });
  }, [selected?.start, selected?.end, columnCount]);

  const inRange = (r: number, c: number) =>
    !!range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;

  // The block reads as one rectangle: only the outer edges of the range are
  // drawn, so the border traces the selection rather than every cell in it.
  const cellAttrs = (
    r: number,
    c: number,
  ): { [key: `data-${string}`]: string | number | undefined; style?: CSSProperties } => {
    if (!inRange(r, c)) return { 'data-r': r, 'data-c': c };
    const edges = [
      r === range!.r1 && 'inset 0 1px 0 0 var(--brand)',
      r === range!.r2 && 'inset 0 -1px 0 0 var(--brand)',
      c === range!.c1 && 'inset 1px 0 0 0 var(--brand)',
      c === range!.c2 && 'inset -1px 0 0 0 var(--brand)',
    ].filter(Boolean);
    return {
      'data-r': r,
      'data-c': c,
      'data-in-range': '',
      style: edges.length ? { boxShadow: edges.join(', ') } : undefined,
    };
  };

  const deltaValue = (x: number): number | null => {
    if (!showDelta) return null;
    const base = at(baseline!, x);
    const cand = at(candidate!, x);
    if (!base || !cand) return null;
    return comparison!.change === 'percent'
      ? base.y === 0
        ? 0
        : 100 * (cand.y / base.y - 1)
      : cand.y - base.y;
  };

  const deltaCell = (x: number, r: number) => {
    if (!showDelta) return null;
    const attrs = cellAttrs(r, primary.length + 1);
    const value = deltaValue(x);
    if (value == null) return <td {...attrs} />;
    const text =
      comparison!.change === 'percent'
        ? `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
        : `${value >= 0 ? '+' : ''}${fmtVal(value)}`;
    return (
      <td className="delta" {...attrs}>
        {text}
      </td>
    );
  };

  // Taking the numbers out is part of reading them. One shape serves both
  // buttons: cells that stack two readings on screen (a value and its band, a
  // count and its share) become their own columns, so a spreadsheet receives
  // numbers to compute with rather than strings to unpick.
  const banded = (series: EvidenceChart['series'][number]) =>
    series.points.some((point) => point.se != null);
  const round = (value: number) => Number(value.toFixed(6));

  const exported = (rows: number[]) => {
    const header: (string | number)[] = [chart.xLabel];
    primary.forEach((series) => {
      header.push(series.label);
      if (banded(series)) {
        header.push(`${series.label} low (-2 SE)`, `${series.label} high (+2 SE)`);
      }
    });
    if (showDelta) {
      // the label often already says percent; only name the unit if it does not
      header.push(
        comparison!.change === 'percent' && !comparison!.label.includes('%')
          ? `${comparison!.label} (%)`
          : comparison!.label,
      );
    }
    if (secondary) {
      header.push(secondary.label);
      if (secondary.label === 'Earned exposure') header.push('Share of exposure (%)');
    }

    const body = rows.map((x) => {
      const cells: (string | number)[] = [labels.get(x) ?? round(x)];
      primary.forEach((series) => {
        const point = at(series, x);
        cells.push(point ? round(point.y) : '');
        if (banded(series)) {
          cells.push(
            point?.se != null ? round(point.y * Math.exp(-2 * point.se)) : '',
            point?.se != null ? round(point.y * Math.exp(2 * point.se)) : '',
          );
        }
      });
      if (showDelta) {
        const value = deltaValue(x);
        cells.push(value == null ? '' : round(value));
      }
      if (secondary) {
        const point = at(secondary, x);
        cells.push(point ? round(point.y) : '');
        if (secondary.label === 'Earned exposure') {
          cells.push(
            point && secondaryTotal > 0 ? round((100 * point.y) / secondaryTotal) : '',
          );
        }
      }
      return cells;
    });

    return [header, ...body];
  };

  // Numbers that leave the app carry what produced them on the line above:
  // an experiment, a run, and the model version they were fitted against.
  // A block of figures nobody can attribute is not evidence any more.
  const provenance = source ?? chart.title;

  // Both paths take the whole table. A selection is for reading the chart
  // beside it, not for deciding what a spreadsheet receives; filtering rows
  // is what the spreadsheet is for.
  // Excel's paste target is tab-separated text; its file target is CSV
  const asTsv = () =>
    [provenance, ...exported(xValues).map((row) => row.join('\t'))].join('\r\n');
  const asCsv = () =>
    [[provenance], ...exported(xValues)]
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell);
            return /["\n\r,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
          })
          .join(','),
      )
      .join('\r\n');

  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const clear = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(clear);
  }, [copied]);

  const copy = async () => {
    const text = asTsv();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard permission or an insecure origin: the old path still works
      const holder = document.createElement('textarea');
      holder.value = text;
      holder.setAttribute('readonly', '');
      holder.style.position = 'fixed';
      holder.style.opacity = '0';
      document.body.appendChild(holder);
      holder.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing left to try; the button simply does not confirm */
        document.body.removeChild(holder);
        return;
      }
      document.body.removeChild(holder);
    }
    setCopied(true);
  };

  const download = () => {
    // the stem names the experiment, run and version where the surface knows
    // them, so a folder of exports stays sorted and attributable
    const name = `${
      fileBase ??
      `${chart.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${mode}`
    }.csv`;
    // the BOM is what makes Excel read the file as UTF-8
    const blob = new Blob([`﻿${asCsv()}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const tools = (
    <div className="exact-tools">
      <button
        type="button"
        className="exact-tool"
        data-done={copied || undefined}
        title="Copy every row as tab-separated text, provenance line first"
        onClick={copy}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button type="button" className="exact-tool" onClick={download}>
        Download CSV
      </button>
      <span className="sr" role="status">
        {copied ? 'Table copied to the clipboard' : ''}
      </span>
    </div>
  );

  const table = (
    <table className="value-grid" {...(onSelectionChange ? gridHandlers : {})}>
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
      <tbody>
        {xValues.map((x, r) => (
          <tr
            key={x}
            data-x={x}
            aria-selected={isSelected(x) || undefined}
            className={isSelected(x) ? 'is-selected' : undefined}
          >
            <th scope="row" {...cellAttrs(r, 0)}>
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
            {primary.map((series, index) => {
              const point = at(series, x);
              const attrs = cellAttrs(r, index + 1);
              if (!point) return <td key={series.label} {...attrs} />;
              return (
                <td key={series.label} {...attrs}>
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
            {deltaCell(x, r)}
            {secondary &&
              (() => {
                const attrs = cellAttrs(r, columnCount - 1);
                const point = at(secondary, x);
                if (!point) return <td {...attrs} />;
                const share =
                  secondary.label === 'Earned exposure' && secondaryTotal > 0
                    ? ` · ${((100 * point.y) / secondaryTotal).toFixed(1)}%`
                    : '';
                return (
                  <td className="weight" {...attrs}>
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
    return (
      <>
        {tools}
        <div className="exact-scroll" role="region" aria-label="Exact values">
          {table}
        </div>
      </>
    );
  }
  return (
    <details className="exact-values">
      <summary>Exact values</summary>
      {tools}
      <div className="exact-scroll">{table}</div>
    </details>
  );
}
