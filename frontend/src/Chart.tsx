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

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EvidenceChart, EvidenceSeries } from './api';

// A narrower viewBox for the same rendered width means the labels inside it
// come out larger on screen
const CARD = {
  W: 460,
  H: 250,
  HL: 306,
  PAD: { l: 64, r: 14, t: 16, b: 52 },
  padBL: 96,
};
const FULL = {
  W: 920,
  H: 470,
  HL: 540,
  PAD: { l: 76, r: 20, t: 22, b: 58 },
  padBL: 112,
};

/** Charts whose natural reference is 1.00 rather than 0 */
const RELATIVITY = new Set(['age_curve', 'segment_effects', 'territory']);
/**
 * Series that carry a different unit from the rest of the chart and so ride a
 * second axis behind everything else. Exposure is the weight under a curve,
 * never a rate, and plotting it on the rate axis would flatten the rates.
 */
const isSecondary = (label: string) =>
  label === 'Earned exposure' || label.startsWith('Share of exposure');

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
  hidden,
  big,
  onExpand,
  autoFocus,
}: {
  chart: EvidenceChart;
  hidden: Set<string>;
  big: boolean;
  /** present on the card view only: click or Enter opens the full screen */
  onExpand?: () => void;
  autoFocus?: boolean;
}) {
  const G = big ? FULL : CARD;
  const PAD = G.PAD;
  const W = G.W;

  const svgRef = useRef<SVGSVGElement>(null);
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

  const allX = primary.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  // Categorical when a series carries tick labels over a short index run,
  // which is how the server sends zones, cells, counts, and folds. A dense
  // numeric axis like single years of age stays numeric even though a few of
  // its points (the knots) are labelled. Detection reads the full series
  // list, so hiding a series never flips the axis style.
  const labelled = primaryAll.find(
    (s) => s.points.length > 0 && s.points.every((p) => p.label != null),
  );
  const categorical =
    !!labelled &&
    primaryAll.every((s) => s.points.length <= 32) &&
    primaryAll.flatMap((s) => s.points.map((p) => p.x)).every((x) => Number.isInteger(x));

  const values = primary.flatMap((s) => s.points.map((p) => p.y));
  if (rel) values.push(1);
  else values.push(0);
  let yLo = Math.min(...values);
  let yHi = Math.max(...values);
  const padY = (yHi - yLo) * 0.12 || Math.abs(yHi) * 0.12 || 1;
  yLo -= padY;
  yHi += padY;
  if (!rel && Math.min(...values) >= 0) yLo = Math.max(0, yLo);

  // Long category names lean rather than crush, and leaning costs height, so
  // the frame grows instead of the labels running off the bottom
  const longLabels =
    categorical && xTicksNeedRotation(labelled?.points.map((p) => p.label ?? ''));
  const padB = longLabels ? G.padBL : PAD.b;
  const H = longLabels ? G.HL : G.H;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - padB;
  const bandCount = categorical
    ? Math.max(...primaryAll.map((s) => s.points.length), 1)
    : 0;
  const band = categorical ? plotW / bandCount : 0;

  const sx = (x: number) =>
    categorical
      ? PAD.l + band * (x - xMin) + band / 2
      : PAD.l + (plotW * (x - xMin)) / (xMax - xMin || 1);
  const sy = (y: number) => PAD.t + plotH * (1 - (y - yLo) / (yHi - yLo || 1));

  const barSeries = primary.filter((s) => s.style === 'bar');
  const barIndex = (s: EvidenceSeries) => barSeries.indexOf(s);
  const barW = categorical
    ? (band * 0.72) / Math.max(barSeries.length, 1)
    : Math.max(plotW / (xMax - xMin + 1) - 1, 1);

  const yTicks = niceTicks(yLo, yHi);
  const catTicks = labelled?.points.map((p) => ({ x: p.x, label: p.label ?? '' })) ?? [];
  // thin the labels when a categorical axis carries more than fits, as the
  // zone axis does at thirty
  const every = Math.ceil(catTicks.length / 12);
  const xTicks = categorical
    ? catTicks.filter((_, i) => i % every === 0)
    : niceTicks(xMin, xMax, 5).map((v) => ({ x: v, label: fmtTick(v, xMax - xMin) }));

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

  const moveTo = (clientX: number) => {
    const el = svgRef.current;
    if (!el || xs.length === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
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
    setHover(best);
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
            },
          ];
        });
  const headLabel =
    hx == null
      ? ''
      : categorical
        ? (catTicks.find((t) => Math.abs(t.x - hx) < 1e-9)?.label ?? String(hx))
        : `${chart.xLabel} ${fmtTick(hx, xMax - xMin || 1)}`;

  // The tooltip is sized from its own mono text, then kept inside the frame
  const tipW = Math.min(
    Math.max(
      headLabel.length * 7,
      ...rows.map((r) => (r.label.length + r.v.length) * 6.9 + 26),
      96,
    ) + 18,
    plotW - 12,
  );
  const tipH = 24 + rows.length * 17;
  const cx = hx == null ? 0 : sx(hx);
  const tipX = Math.max(
    PAD.l + 2,
    cx + 14 + tipW > W - PAD.r ? cx - tipW - 14 : cx + 14,
  );
  const tipY = PAD.t + 6;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${chart.title}. ${chart.notes.join('. ')}`}
      preserveAspectRatio="xMidYMid meet"
      tabIndex={0}
      data-expandable={onExpand ? '1' : undefined}
      onMouseMove={(e) => moveTo(e.clientX)}
      onMouseLeave={() => setHover(null)}
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const step = e.key === 'ArrowRight' ? 1 : -1;
          setHover((h) =>
            h == null
              ? step > 0
                ? 0
                : xs.length - 1
              : Math.min(xs.length - 1, Math.max(0, h + step)),
          );
        } else if (e.key === 'Enter' && onExpand) {
          onExpand();
        } else if (e.key === 'Escape' && hover != null) {
          // first Escape clears the readout; the next one reaches the layer
          // above, so a reader inside the palette is never dumped out of it
          e.stopPropagation();
          setHover(null);
        }
      }}
    >
      <title>{chart.title}</title>
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
          <text className="tick" x={PAD.l - 8} y={sy(t) + 4} textAnchor="end">
            {fmtTick(t, yHi - yLo)}
          </text>
        </g>
      ))}

      {hx != null && categorical && (
        <rect
          className="bandlite"
          x={sx(hx) - band / 2}
          y={PAD.t}
          width={band}
          height={plotH}
        />
      )}

      {secondary && (
        <g className="exposure">
          {secondary.points.map((p, i) => (
            <rect
              key={`e${i}`}
              x={sx(p.x) - secW / 2}
              y={secY(p.y)}
              width={secW}
              height={Math.max(PAD.t + plotH - secY(p.y), 0)}
            />
          ))}
        </g>
      )}

      {/* the line every relativity chart is read against */}
      <line
        className="zero"
        x1={PAD.l}
        x2={W - PAD.r}
        y1={sy(rel ? 1 : 0)}
        y2={sy(rel ? 1 : 0)}
      />

      {primary.map((s) => {
        const c = color(s);
        if (s.style === 'bar') {
          const off = categorical
            ? -((barSeries.length * barW) / 2) + barIndex(s) * barW
            : -barW / 2;
          return (
            <g key={s.label} className="bars">
              {s.points.map((p, i) => {
                const base = sy(rel ? 1 : 0);
                const top = sy(p.y);
                const last =
                  chart.kind === 'segment_effects' && i === s.points.length - 1;
                return (
                  <g key={i}>
                    <rect
                      x={sx(p.x) + off}
                      y={Math.min(top, base)}
                      width={barW}
                      height={Math.max(Math.abs(base - top), 1)}
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
            {rows.map((r, i) => (
              <g key={r.label}>
                <rect
                  x={tipX + 9}
                  y={tipY + 24 + i * 17}
                  width={7}
                  height={7}
                  rx={1.5}
                  style={{ fill: r.col }}
                />
                <text x={tipX + 21} y={tipY + 31 + i * 17}>
                  {r.label}
                </text>
                <text x={tipX + tipW - 9} y={tipY + 31 + i * 17} textAnchor="end">
                  {r.v}
                </text>
              </g>
            ))}
          </g>
        </g>
      )}

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
        className="axis"
        x={0}
        y={0}
        transform={`translate(13 ${PAD.t + plotH / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {chart.yLabel}
      </text>
    </svg>
  );
}

export default function Chart({
  chart,
  plain,
}: {
  chart: EvidenceChart;
  plain: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState(false);
  const primaryAll = chart.series.filter((s) => !isSecondary(s.label));

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
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padRight;
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

  const legend = (
    <div className="legend">
      {chart.series.map((s) => (
        <button
          key={s.label}
          type="button"
          className={hidden.has(s.label) ? 'off' : undefined}
          aria-pressed={!hidden.has(s.label)}
          disabled={chart.series.length < 2}
          onClick={() => toggle(s.label)}
        >
          <i
            data-style={s.style}
            style={{ background: seriesColor(chart, s, primaryAll) }}
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

  return (
    <figure className="chart" data-kind={chart.kind}>
      <figcaption>{chart.title}</figcaption>
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
      <Plot chart={chart} hidden={hidden} big={false} onExpand={() => setExpanded(true)} />
      {legend}
      {notes}
      {plain && <div className="gloss">{chart.gloss}</div>}

      {expanded &&
        createPortal(
          <div className="chart-scrim" onMouseDown={() => setExpanded(false)}>
            <figure
              className="chart chart-full"
              data-kind={chart.kind}
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
              <Plot chart={chart} hidden={hidden} big autoFocus />
              {legend}
              {notes}
              {plain && <div className="gloss">{chart.gloss}</div>}
              <span className="chart-hint">
                Hover any point for its number · arrow keys walk the axis · the
                legend turns a series off · Esc closes
              </span>
            </figure>
          </div>,
          document.body,
        )}
    </figure>
  );
}
