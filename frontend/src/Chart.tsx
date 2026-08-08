// One SVG renderer for every artifact the platform keeps. No chart library:
// the shapes are few and the styling has to follow the theme tokens.
//
// The server sends a chart as named series with a style hint, so the same
// component draws an age curve, a lift staircase, a fold strip, and a factor
// decomposition without knowing what any of them mean.
//
// Every drawn point answers with its number: hover or arrow keys read the
// exact stored value back, a click opens the chart full screen, and the
// legend turns series on and off so one curve can be read alone.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EvidenceChart, EvidenceSeries } from './api';
import {
  buildAgentQuestion,
  contractFor,
  displayChart,
  isSecondarySeries,
  makeSavedEvidence,
  normalizeSelection,
  selectionLabel,
  selectionValues,
  weakActionLabel,
  weakestSelection,
  weakPoint,
  type ChartContract,
  type ChartMode,
  type ChartSelection,
  type ChartWorkspaceContext,
} from './chartWorkspace';

// A narrower viewBox for the same rendered width means the labels inside it
// come out larger on screen
const CARD = {
  W: 460,
  H: 250,
  HL: 306,
  PAD: { l: 86, r: 14, t: 16, b: 52 },
  padBL: 96,
  yTitleX: 13,
};
const FULL = {
  W: 920,
  H: 470,
  HL: 540,
  PAD: { l: 108, r: 20, t: 22, b: 58 },
  padBL: 112,
  yTitleX: 15,
};

/** Charts whose natural reference is 1.00 rather than 0 */
const RELATIVITY = new Set(['age_curve', 'segment_effects', 'territory']);
/**
 * Series that carry a different unit from the rest of the chart and so ride a
 * second axis behind everything else. Exposure is the weight under a curve,
 * never a rate, and plotting it on the rate axis would flatten the rates.
 */
const isSecondary = (label: string) => isSecondarySeries(label);

function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return [lo];
  const span = hi - lo;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let v = start; v <= hi + step * 1e-6; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Category names longer than a tick slot get rotated rather than crushed */
function xTicksNeedRotation(labels?: string[]): boolean {
  if (!labels || labels.length < 3) return false;
  return labels.some((l) => l.length > 6);
}

function fmtTick(v: number, span: number): string {
  const a = Math.abs(v);
  if (span < 0.02) return v.toFixed(3);
  if (span < 0.2) return v.toFixed(2);
  if (a >= 1000) return `${Math.round(v / 1000)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2);
}

/** One axis, one precision: 1 / 1.5 / 2, never 1 / 1.50 / 2 */
function fmtAxis(ticks: number[]): string[] {
  const dec = ticks.every((t) => Number.isInteger(t))
    ? 0
    : Math.min(
        3,
        Math.max(
          ...ticks.map((t) => {
            const s = t.toString();
            const i = s.indexOf('.');
            return i < 0 ? 0 : s.length - i - 1;
          }),
        ),
      );
  return ticks.map((t) =>
    dec === 0 && Math.abs(t) >= 1000 ? `${Math.round(t / 1000)}k` : t.toFixed(dec),
  );
}

/** The readout shows the stored value, trimmed only of noise digits */
export function fmtVal(y: number): string {
  if (Number.isInteger(y)) return String(y);
  const a = Math.abs(y);
  if (a >= 100) return y.toFixed(1);
  if (a >= 10) return y.toFixed(2);
  return y.toFixed(3);
}

function seriesColor(
  chart: EvidenceChart,
  s: EvidenceSeries,
  primaryAll: EvidenceSeries[],
): string {
  if (isSecondary(s.label)) return 'var(--chart-exposure)';
  const i = primaryAll.indexOf(s);
  if (chart.kind === 'segment_effects') return 'var(--chart-band)';
  if (s.label.startsWith('v12') || s.label.includes('v12')) return 'var(--chart-base)';
  if (s.style === 'bar') return i === 0 ? 'var(--chart-band)' : 'var(--chart-alt)';
  return i === 0 ? 'var(--chart-line)' : 'var(--chart-alt)';
}

function Plot({
  chart,
  contract,
  mode,
  selection,
  onSelectionChange,
  hidden,
  big,
  autoFocus,
}: {
  chart: EvidenceChart;
  contract: ChartContract;
  mode: ChartMode;
  selection: ChartSelection | null;
  onSelectionChange: (selection: ChartSelection | null) => void;
  hidden: Set<string>;
  big: boolean;
  autoFocus?: boolean;
}) {
  const G = big ? FULL : CARD;
  const PAD = G.PAD;
  const W = G.W;

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ index: number; clientX: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (autoFocus) svgRef.current?.focus();
  }, [autoFocus]);

  const primaryAll = chart.series.filter((s) => !isSecondary(s.label));
  const primaryVis = primaryAll.filter((s) => !hidden.has(s.label));
  const primary = primaryVis.length > 0 ? primaryVis : primaryAll;
  const secondaryAll = chart.series.find((s) => isSecondary(s.label));
  const secondary =
    secondaryAll && !hidden.has(secondaryAll.label) ? secondaryAll : undefined;
  const rel = RELATIVITY.has(chart.kind);

  // Categorical when a series carries tick labels over a short index run,
  // which is how the server sends zones, cells, counts, and folds. A dense
  // numeric axis like single years of age stays numeric even though a few of
  // its points (the knots) are labelled. Detection reads the full series
  // list, so hiding a series never flips the axis style.
  const allXAll = primaryAll.flatMap((s) => s.points.map((p) => p.x));
  const labelled = primaryAll.find(
    (s) => s.points.length > 0 && s.points.every((p) => p.label != null),
  );
  const categorical =
    !!labelled &&
    primaryAll.every((s) => s.points.length <= 32) &&
    allXAll.every((x) => Number.isInteger(x));

  // A categorical axis keeps the full band layout whatever is toggled off,
  // so bars never slide under another series' captions
  const allX = primary.flatMap((s) => s.points.map((p) => p.x));
  const xMin = categorical ? Math.min(...allXAll) : Math.min(...allX);
  const xMax = categorical ? Math.max(...allXAll) : Math.max(...allX);

  const values = primary.flatMap((s) => s.points.map((p) => p.y));
  if (rel) values.push(1);
  else values.push(0);
  const activeGuardrail =
    contract.guardrail &&
    (contract.guardrail.applies === 'both' || contract.guardrail.applies === mode)
      ? contract.guardrail
      : undefined;
  if (activeGuardrail?.low != null) values.push(activeGuardrail.low);
  if (activeGuardrail?.high != null) values.push(activeGuardrail.high);
  let yLo = Math.min(...values);
  let yHi = Math.max(...values);
  const padY = (yHi - yLo) * 0.12 || Math.abs(yHi) * 0.12 || 1;
  yLo -= padY;
  yHi += padY;
  if (!rel && Math.min(...values) >= 0) yLo = Math.max(0, yLo);

  // Long category names lean rather than crush, and leaning costs height, so
  // the frame grows instead of the labels running off the bottom
  const longLabels =
    categorical &&
    (xTicksNeedRotation(
      primaryAll.flatMap((s) => s.points.map((p) => p.label ?? '')),
    ) || new Set(allXAll).size > 8);
  const padB = longLabels ? G.padBL : PAD.b;
  const H = longLabels ? G.HL : G.H;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - padB;
  const bandCount = categorical ? xMax - xMin + 1 : 0;
  const band = categorical ? plotW / bandCount : 0;

  const sx = (x: number) =>
    categorical
      ? PAD.l + band * (x - xMin) + band / 2
      : PAD.l + (plotW * (x - xMin)) / (xMax - xMin || 1);
  const sy = (y: number) => PAD.t + plotH * (1 - (y - yLo) / (yHi - yLo || 1));

  const barSeries = primary.filter((s) => s.style === 'bar');
  // bars share a band only where their series actually meet, so two series
  // on disjoint bands each sit centered instead of half shifted
  const barsAt = (x: number) =>
    barSeries.filter((b) => b.points.some((pt) => Math.abs(pt.x - x) < 1e-9));
  const concurrent = categorical
    ? Math.max(1, ...Array.from(new Set(allXAll)).map((x) => barsAt(x).length))
    : Math.max(barSeries.length, 1);
  const barW = categorical
    ? (band * 0.72) / concurrent
    : Math.max(plotW / (xMax - xMin + 1) - 1, 1);

  const yTicks = niceTicks(yLo, yHi);
  const yTickLabels = fmtAxis(yTicks);
  // Band captions come from every series, first label per x winning, so a
  // chart whose series own different bands captions each band with its own
  // name rather than borrowing the first series' labels
  const labelByX = new Map<number, string>();
  primaryAll.forEach((s) =>
    s.points.forEach((p) => {
      if (p.label != null && !labelByX.has(p.x)) labelByX.set(p.x, p.label);
    }),
  );
  const catTicks = categorical
    ? [...labelByX.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([x, label]) => ({ x, label }))
    : [];
  // thin the labels when a categorical axis carries more than fits, as the
  // zone axis does at thirty
  const every = Math.ceil(catTicks.length / 12);
  const numTicks = niceTicks(xMin, xMax, 5);
  const numTickLabels = fmtAxis(numTicks);
  const xTicks = categorical
    ? catTicks.filter((_, i) => i % every === 0)
    : numTicks.map((v, i) => ({ x: v, label: numTickLabels[i] }));

  // Second axis for the weight behind a curve, kept short so it reads as
  // background rather than as another result
  const secMax = secondary ? Math.max(...secondary.points.map((p) => p.y), 1) : 1;
  const secY = (y: number) => PAD.t + plotH * (1 - (y / secMax) * 0.45);
  const secW = secondary
    ? categorical
      ? band * 0.5
      : Math.max(plotW / secondary.points.length - 1.5, 1)
    : 0;

  const color = (s: EvidenceSeries) => seriesColor(chart, s, primaryAll);

  // The hover walks the union of every visible x, so a chart whose series
  // share a grid reads as one readout per position
  const readable: EvidenceSeries[] = [...primary, ...(secondary ? [secondary] : [])];
  const xs = Array.from(new Set(readable.flatMap((s) => s.points.map((p) => p.x)))).sort(
    (a, b) => a - b,
  );
  const at = (s: EvidenceSeries, x: number) =>
    s.points.find((p) => Math.abs(p.x - x) < 1e-9);

  const nearestIndex = (clientX: number) => {
    const el = svgRef.current;
    if (!el || xs.length === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return null;
    const vx = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    xs.forEach((x, i) => {
      const d = Math.abs(sx(x) - vx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  const moveTo = (clientX: number) => {
    const best = nearestIndex(clientX);
    if (best == null) return;
    setHover(best);
    if (dragRef.current && contract.range) {
      onSelectionChange({ start: xs[dragRef.current.index], end: xs[best] });
    }
  };

  const hx = hover != null && hover < xs.length ? xs[hover] : null;
  const rows =
    hx == null
      ? []
      : readable.flatMap((s) => {
          const p = at(s, hx);
          if (!p) return [];
          const sec = isSecondary(s.label);
          return [
            {
              label: s.label,
              v: sec ? p.y.toFixed(1) : fmtVal(p.y),
              col: color(s),
              style: s.style,
            },
          ];
        });
  const headLabel =
    hx == null
      ? ''
      : categorical
        ? (catTicks.find((t) => Math.abs(t.x - hx) < 1e-9)?.label ?? String(hx))
        : `${chart.xLabel} ${fmtTick(hx, xMax - xMin || 1)}`;

  // The tooltip uses a 15px monospace face. Budget the label and value as
  // separate columns; the previous 6.9px/character estimate was too narrow
  // and let long labels such as "Earned exposure" collide with their values.
  const tipCharW = 8.4;
  const tipW = Math.min(
    Math.max(
      headLabel.length * tipCharW + 18,
      ...rows.map((r) => (r.label.length + r.v.length) * tipCharW + 50),
      116,
    ),
    plotW - 12,
  );
  const tipH = 24 + rows.length * 17;
  const cx = hx == null ? 0 : sx(hx);
  // the readout sits in the corner away from the crosshair, so the data
  // being read stays visible under the cursor
  const tipX = Math.max(
    PAD.l + 2,
    cx < PAD.l + plotW / 2 ? W - PAD.r - tipW - 6 : PAD.l + 6,
  );
  const tipY = PAD.t + 6;
  const selected = selection ? normalizeSelection(selection) : null;
  const selectionX = selected
    ? {
        start: sx(selected.start),
        end: sx(selected.end),
      }
    : null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${chart.title}. ${contract.question} ${chart.notes.join('. ')}`}
      preserveAspectRatio="xMidYMid meet"
      tabIndex={0}
      onPointerDown={(event) => {
        // A chart drag is an application gesture, not a browser text-selection gesture.
        // Preventing the native default here stops SVG ticks/axis labels from becoming
        // blue-selected when the pointer crosses them.
        event.preventDefault();
        const index = nearestIndex(event.clientX);
        if (index == null) return;
        svgRef.current?.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { index, clientX: event.clientX };
        setHover(index);
      }}
      onPointerMove={(event) => {
        if (dragRef.current) event.preventDefault();
        moveTo(event.clientX);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        const drag = dragRef.current;
        const index = nearestIndex(event.clientX);
        if (drag && index != null) {
          const moved = Math.abs(event.clientX - drag.clientX) > 6;
          onSelectionChange(
            contract.range && moved
              ? { start: xs[drag.index], end: xs[index] }
              : { start: xs[index], end: xs[index] },
          );
        }
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onDragStart={(event) => event.preventDefault()}
      onPointerLeave={() => {
        if (!dragRef.current) setHover(null);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const step = e.key === 'ArrowRight' ? 1 : -1;
          const next =
            hover == null
              ? step > 0
                ? 0
                : xs.length - 1
              : Math.min(xs.length - 1, Math.max(0, hover + step));
          setHover(next);
          if (e.shiftKey && contract.range) {
            const anchor = selection?.start ?? xs[hover ?? next];
            onSelectionChange({ start: anchor, end: xs[next] });
          }
        } else if (e.key === 'Enter' && hover != null) {
          e.preventDefault();
          onSelectionChange({ start: xs[hover], end: xs[hover] });
        } else if (e.key === 'Escape' && (selection || hover != null)) {
          e.stopPropagation();
          onSelectionChange(null);
          setHover(null);
        }
      }}
    >
      <title>{chart.title}</title>
      <g className="chart-layer chart-layer-axes">
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
            <text className="tick y-axis-tick" x={PAD.l - 10} y={sy(t) + 4} textAnchor="end">
              {yTickLabels[yTicks.indexOf(t)]}
            </text>
          </g>
        ))}
      </g>

      <g className="chart-layer chart-layer-annotations">
        {activeGuardrail &&
          [activeGuardrail.low, activeGuardrail.high]
            .filter((value): value is number => value != null)
            .map((value) => (
              <g className="guardrail" key={`guardrail-${value}`}>
                <line
                  className="guardrail-line"
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={sy(value)}
                  y2={sy(value)}
                />
                <text className="guardrail-label" x={W - PAD.r - 3} y={sy(value) - 5} textAnchor="end">
                  {value > 0 ? `+${value}` : value}{mode === 'change' ? '%' : ''}
                </text>
              </g>
            ))}

        {selectionX && (
          <rect
            className="selection-band"
            x={Math.min(selectionX.start, selectionX.end) - (categorical ? band / 2 : 4)}
            y={PAD.t}
            width={
              Math.max(
                Math.abs(selectionX.end - selectionX.start) + (categorical ? band : 8),
                8,
              )
            }
            height={plotH}
          />
        )}
      </g>

      {hx != null && categorical && (
        <rect
          className="bandlite"
          x={sx(hx) - band / 2}
          y={PAD.t}
          width={band}
          height={plotH}
        />
      )}

      <g className="exposure chart-layer chart-layer-exposure">
        {secondary && (
          <>
          {secondary.points.map((p, i) => (
            <rect
              key={`e${i}`}
              x={sx(p.x) - secW / 2}
              y={secY(p.y)}
              width={secW}
              height={Math.max(PAD.t + plotH - secY(p.y), 0)}
            />
          ))}
          </>
        )}
      </g>

      {/* the line every relativity chart is read against */}
      <g className="chart-layer chart-layer-axes">
        <line
          className="zero"
          x1={PAD.l}
          x2={W - PAD.r}
          y1={sy(rel ? 1 : 0)}
          y2={sy(rel ? 1 : 0)}
        />
      </g>

      <g className="chart-layer chart-layer-evidence">
        {primary.map((s) => {
        const c = color(s);
        if (s.style === 'bar') {
          return (
            <g key={s.label} className="bars">
              {s.points.map((p, i) => {
                const group = categorical ? barsAt(p.x) : barSeries;
                const off = categorical
                  ? -((group.length * barW) / 2) + group.indexOf(s) * barW
                  : -barW / 2;
                const base = sy(rel ? 1 : 0);
                const top = sy(p.y);
                const last =
                  chart.kind === 'segment_effects' && i === s.points.length - 1;
                // a factor that moves nothing still gets a nub on the
                // baseline: measured and near zero, not missing
                const nub =
                  chart.kind === 'segment_effects' && Math.abs(base - top) < 2.5;
                const breached =
                  !!activeGuardrail &&
                  ((activeGuardrail.low != null && p.y < activeGuardrail.low) ||
                    (activeGuardrail.high != null && p.y > activeGuardrail.high));
                return (
                  <g key={i}>
                    <rect
                      className={breached ? 'guardrail-breach' : undefined}
                      x={sx(p.x) + off}
                      y={nub ? base - 1.25 : Math.min(top, base)}
                      width={barW}
                      height={nub ? 2.5 : Math.max(Math.abs(base - top), 1)}
                      fill={last ? 'var(--chart-line)' : c}
                    />
                    {/* a decomposition is unreadable without its numbers,
                        but a factor that moves nothing does not need a
                        label saying so */}
                    {chart.kind === 'segment_effects' &&
                      (Math.abs(p.y - 1) >= 0.005 || last) && (
                        <text
                          className="val"
                          x={sx(p.x) + off + barW / 2}
                          y={p.y >= 1 ? Math.min(top, base) - 4 : Math.max(top, base) + 11}
                          textAnchor="middle"
                        >
                          {`${p.y >= 1 ? '+' : ''}${Math.round((p.y - 1) * 100)}%`}
                        </text>
                      )}
                  </g>
                );
              })}
            </g>
          );
        }
        if (s.style === 'dot') {
          return (
            <g key={s.label} className="dots">
              {s.points.map((p, i) => (
                <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.2} fill={c} />
              ))}
            </g>
          );
        }
        const d =
          s.style === 'step'
            ? s.points
                .map((p, i) => {
                  const prev = s.points[i - 1];
                  return i === 0
                    ? `M${sx(p.x)},${sy(p.y)}`
                    : `L${sx(p.x)},${sy(prev.y)} L${sx(p.x)},${sy(p.y)}`;
                })
                .join(' ')
            : s.points
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x)},${sy(p.y)}`)
                .join(' ');
        return (
          <path
            key={s.label}
            d={d}
            fill="none"
            stroke={c}
            strokeWidth={s.style === 'step' ? 1.4 : 1.8}
            strokeDasharray={s.style === 'step' ? '4 3' : undefined}
          />
        );
        })}
      </g>

      {hx != null && (
        <g className="hoverlayer">
          {!categorical && (
            <line className="cross" x1={cx} x2={cx} y1={PAD.t} y2={PAD.t + plotH} />
          )}
          {primary
            .filter((s) => s.style !== 'bar')
            .flatMap((s) => {
              const p = at(s, hx);
              return p
                ? [
                    <circle
                      key={`m${s.label}`}
                      className="mark"
                      cx={sx(p.x)}
                      cy={sy(p.y)}
                      r={3.8}
                      fill={color(s)}
                    />,
                  ]
                : [];
            })}
          <g className="tip">
            <rect className="tipbg" x={tipX} y={tipY} width={tipW} height={tipH} rx={4} />
            <text className="tiphead" x={tipX + 9} y={tipY + 15}>
              {headLabel}
            </text>
            {rows.map((r, i) => {
              // the swatch takes the shape the series draws with, so two
              // series sharing an ink still read apart
              const cy = tipY + 27.5 + i * 17;
              return (
                <g className="tiprow" key={r.label}>
                  {r.style === 'dot' ? (
                    <circle cx={tipX + 12.5} cy={cy} r={3.2} style={{ fill: r.col }} />
                  ) : r.style === 'bar' ? (
                    <rect
                      x={tipX + 9}
                      y={cy - 3.5}
                      width={7}
                      height={7}
                      rx={1.5}
                      style={{ fill: r.col }}
                    />
                  ) : (
                    <rect
                      x={tipX + 7}
                      y={cy - 1.25}
                      width={11}
                      height={2.5}
                      style={{ fill: r.col }}
                    />
                  )}
                  <text className="tiplabel" x={tipX + 23} y={cy + 3.5}>
                    {r.label}
                  </text>
                  <text className="tipvalue" x={tipX + tipW - 9} y={cy + 3.5} textAnchor="end">
                    {r.v}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      )}

      <g className="chart-layer chart-layer-axes">
        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            className="tick"
            x={longLabels ? 0 : sx(t.x)}
            y={longLabels ? 0 : H - padB + 20}
            transform={
              longLabels
                ? `translate(${sx(t.x)} ${H - padB + 20}) rotate(-38)`
                : undefined
            }
            textAnchor={longLabels ? 'end' : 'middle'}
          >
            {t.label}
          </text>
        ))}
        {!longLabels && (
          <text className="axis" x={PAD.l} y={H - 6}>
            {chart.xLabel}
          </text>
        )}
        <text
          className="axis y-axis-title"
          x={0}
          y={0}
          transform={`translate(${G.yTitleX} ${PAD.t + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {chart.yLabel}
        </text>
      </g>
    </svg>
  );
}

export default function Chart({
  chart,
  plain,
  selection: controlledSelection,
  mode: controlledMode,
  onSelectionChange,
  onModeChange,
  context,
}: {
  chart: EvidenceChart;
  plain: boolean;
  selection?: ChartSelection | null;
  mode?: ChartMode;
  onSelectionChange?: (selection: ChartSelection | null) => void;
  onModeChange?: (mode: ChartMode) => void;
  context?: ChartWorkspaceContext;
}) {
  const contract = useMemo(() => contractFor(chart), [chart]);
  const [localSelection, setLocalSelection] = useState<ChartSelection | null>(null);
  const [localMode, setLocalMode] = useState<ChartMode>(() => contract.defaultMode);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const [actionStatus, setActionStatus] = useState('');
  // the wide frame follows the viewport while the full view is open, so a
  // window dragged narrow reflows instead of keeping unreadable text
  const [wide, setWide] = useState(true);
  const [widePlot, setWidePlot] = useState(() => window.innerWidth >= 1241);
  const selection = controlledSelection === undefined ? localSelection : controlledSelection;
  const mode = controlledMode ?? localMode;
  const shown = useMemo(() => displayChart(chart, contract, mode), [chart, contract, mode]);
  const primaryAll = shown.series.filter((s) => !isSecondary(s.label));
  const setSelection = (next: ChartSelection | null) => {
    setActionStatus('');
    if (onSelectionChange) onSelectionChange(next);
    else setLocalSelection(next);
  };
  const setMode = (next: ChartMode) => {
    setActionStatus('');
    if (onModeChange) onModeChange(next);
    else setLocalMode(next);
  };
  const selectedValues = selection ? selectionValues(shown, selection) : [];
  const weakness = weakPoint(chart, contract);
  // With nothing pinned, the slot leads with the weak point's own numbers
  // instead of usage instructions: the thinnest slice is the first thing a
  // reviewer will want to interrogate, so it is one press away
  const weakSelection = useMemo(() => weakestSelection(chart), [chart]);
  const weakValues = useMemo(
    () => (weakSelection ? selectionValues(shown, weakSelection) : []),
    [shown, weakSelection],
  );

  useEffect(() => setHidden(new Set()), [mode, chart.kind]);

  useEffect(() => {
    const onResize = () => setWidePlot(window.innerWidth >= 1241);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onR = () => setWide(window.innerWidth >= 700);
    onR();
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [expanded]);

  const toggle = (label: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
        return next;
      }
      // the chart never goes blank: the last visible result series stays
      const isPrim = primaryAll.some((s) => s.label === label);
      const visPrim = primaryAll.filter((s) => !next.has(s.label)).length;
      if (isPrim && visPrim <= 1) return prev;
      next.add(label);
      return next;
    });

  // While the full view is up, the page underneath holds still. Padding for
  // the scrollbar width keeps the layout from jumping as it is taken away.
  useEffect(() => {
    if (!expanded) return;
    const { body } = document;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    const overflow = body.style.overflow;
    const padRight = body.style.paddingRight;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    // one live Esc affordance at a time: the palette's chip stands down
    // while the chart holds the key
    body.classList.add('chartfull');
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padRight;
      body.classList.remove('chartfull');
    };
  }, [expanded]);

  // Escape closes the full view first and stops there, so a chart opened
  // from inside the palette hands focus back to the palette, not the page
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setExpanded(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [expanded]);

  const visPrim = primaryAll.filter((s) => !hidden.has(s.label)).length;
  const legend = (
    <div className="legend">
      {shown.series.map((s) => (
        <button
          key={s.label}
          type="button"
          className={hidden.has(s.label) ? 'off' : undefined}
          aria-pressed={!hidden.has(s.label)}
          disabled={
            shown.series.length < 2 ||
            // the last visible result series cannot be turned off, and the
            // button says so instead of silently ignoring the click
            (visPrim <= 1 &&
              !hidden.has(s.label) &&
              primaryAll.some((p) => p.label === s.label))
          }
          onClick={() => toggle(s.label)}
        >
          <i
            data-style={s.style}
            style={{ background: seriesColor(shown, s, primaryAll) }}
          />
          {s.label}
        </button>
      ))}
    </div>
  );

  const notes = (
    <ul className="notes">
      {chart.notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setActionStatus('Evidence link copied');
    } catch {
      const input = document.createElement('input');
      input.value = location.href;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      setActionStatus('Evidence link copied');
    }
  }

  return (
    <figure className="chart chart-workspace" data-kind={chart.kind} data-mode={mode}>
      <div className="chart-title-row">
        <div>
          <span className="chart-question">{contract.question}</span>
          <figcaption>{chart.title}</figcaption>
        </div>
        {contract.comparison && (
          <div className="chart-mode" aria-label="Chart comparison">
            <button type="button" aria-pressed={mode === 'level'} onClick={() => setMode('level')}>
              Level
            </button>
            <button type="button" aria-pressed={mode === 'change'} onClick={() => setMode('change')}>
              Change
            </button>
          </div>
        )}
      </div>
      <span className="chart-y-readout">{shown.yLabel}</span>
      <Plot
        chart={shown}
        contract={contract}
        mode={mode}
        selection={selection}
        onSelectionChange={setSelection}
        hidden={hidden}
        big={widePlot}
      />
      <button
        type="button"
        className="expand"
        aria-label="Open full screen"
        onClick={() => setExpanded(true)}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M1 4.2 V1 H4.2 M7.8 1 H11 V4.2 M11 7.8 V11 H7.8 M4.2 11 H1 V7.8" />
        </svg>
      </button>
      {legend}
      <aside className="chart-diagnostics" aria-label="Chart diagnostics and actions">
        <div className="chart-weakness"><b>Weakest</b>{weakness}</div>
        <div className="chart-source">
          {context
            ? `${context.code} · run ${context.runId} · ${context.target} / ${context.denominator}`
            : `${chart.xLabel} / ${shown.yLabel}`}
        </div>
        <div className="chart-selection-slot">
          {selection ? (
            <div className="chart-selection" aria-live="polite">
            <div className="selection-readout">
              <span className="selection-label">{selectionLabel(chart, selection)}</span>
              <div className="selection-values">
                {selectedValues.map((value) => <span key={value}>{value}</span>)}
              </div>
            </div>
            <div className="chart-actions">
              {context && (
                <>
                  <button
                    type="button"
                    onClick={() => context.onAsk(buildAgentQuestion(chart, context, selection, mode))}
                  >
                    Ask about selection
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      context.onSave(makeSavedEvidence(chart, context, selection, mode));
                      setActionStatus('Saved to human review');
                    }}
                  >
                    Save to review
                  </button>
                  <button type="button" onClick={copyLink}>Copy evidence link</button>
                </>
              )}
              <button type="button" onClick={() => setSelection(null)}>Clear</button>
            </div>
            <span className="chart-action-status" role="status">{actionStatus}</span>
            </div>
          ) : weakSelection ? (
            <div className="chart-selection-empty chart-selection-weak">
              <button
                type="button"
                className="pin-weakest"
                onClick={() => setSelection(weakSelection)}
              >
                {weakActionLabel(chart)} · {selectionLabel(chart, weakSelection)}
              </button>
              <div className="selection-values">
                {weakValues.map((value) => <span key={value}>{value}</span>)}
              </div>
              <span className="empty-hint">
                Hover previews · click or Enter pins
                {contract.range ? ' · drag or Shift plus arrow selects a range' : ''}
              </span>
            </div>
          ) : (
            <div className="chart-selection-empty">
              Hover previews · click or Enter pins
              {contract.range ? ' · drag or Shift plus arrow selects a range' : ''}
            </div>
          )}
        </div>
        <details className="chart-notes">
          <summary>Method notes</summary>
          {notes}
        </details>
      </aside>
      {plain && <div className="gloss">{chart.gloss}</div>}

      {expanded &&
        createPortal(
          <div className="chart-scrim" onMouseDown={() => setExpanded(false)}>
            <figure
              className="chart chart-workspace chart-full"
              data-kind={chart.kind}
              data-mode={mode}
              role="dialog"
              aria-modal="true"
              aria-label={chart.title}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <figcaption>{chart.title}</figcaption>
              <button
                type="button"
                className="chart-close"
                onClick={() => setExpanded(false)}
              >
                Esc
              </button>
              {/* a phone squeezes the wide frame into unreadable text, so the
                  full view keeps the card geometry there */}
              <Plot
                chart={shown}
                contract={contract}
                mode={mode}
                selection={selection}
                onSelectionChange={setSelection}
                hidden={hidden}
                big={wide}
                autoFocus
              />
              {legend}
              {notes}
              {plain && <div className="gloss">{chart.gloss}</div>}
              <span className="chart-hint">
                Hover previews · Enter pins · arrow keys walk the axis
                {contract.range ? ' · Shift plus arrow selects a range' : ''} · Esc closes
              </span>
            </figure>
          </div>,
          document.body,
        )}
    </figure>
  );
}
