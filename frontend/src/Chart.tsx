// One SVG renderer for every artifact the platform keeps. No chart library:
// the shapes are few and the styling has to follow the theme tokens.
//
// The server sends a chart as named series with a style hint, so the same
// component draws an age curve, a lift staircase, a fold strip, and a factor
// decomposition without knowing what any of them mean.

import { useId } from 'react';
import type { EvidenceChart, EvidenceSeries } from './api';

const W = 560;
const H = 250;
const PAD = { l: 54, r: 14, t: 14, b: 46 };

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

export default function Chart({
  chart,
  plain,
}: {
  chart: EvidenceChart;
  plain: boolean;
}) {
  const uid = useId().replace(/[:]/g, '');
  const primary = chart.series.filter((s) => !isSecondary(s.label));
  const secondary = chart.series.find((s) => isSecondary(s.label));
  const rel = RELATIVITY.has(chart.kind);

  const allX = primary.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  // Categorical when a series carries tick labels over a short index run,
  // which is how the server sends zones, cells, counts, and folds. A dense
  // numeric axis like single years of age stays numeric even though a few of
  // its points (the knots) are labelled.
  const labelled = primary.find(
    (s) => s.points.length > 0 && s.points.every((p) => p.label != null),
  );
  const categorical =
    !!labelled &&
    primary.every((s) => s.points.length <= 32) &&
    allX.every((x) => Number.isInteger(x));

  const values = primary.flatMap((s) => s.points.map((p) => p.y));
  if (rel) values.push(1);
  else values.push(0);
  let yLo = Math.min(...values);
  let yHi = Math.max(...values);
  const padY = (yHi - yLo) * 0.12 || Math.abs(yHi) * 0.12 || 1;
  yLo -= padY;
  yHi += padY;
  if (!rel && Math.min(...values) >= 0) yLo = Math.max(0, yLo);

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const bandCount = categorical ? Math.max(...primary.map((s) => s.points.length), 1) : 0;
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

  // Long category names need room, so they lean
  const longLabels =
    categorical && xTicksNeedRotation(primary[0]?.points.map((p) => p.label ?? ''));

  const color = (s: EvidenceSeries, i: number) => {
    if (chart.kind === 'segment_effects') return 'var(--chart-band)';
    if (s.label.startsWith('v12') || s.label.includes('v12')) return 'var(--chart-base)';
    if (s.style === 'bar') return i === 0 ? 'var(--chart-band)' : 'var(--chart-alt)';
    return i === 0 ? 'var(--chart-line)' : 'var(--chart-alt)';
  };

  return (
    <figure className="chart" data-kind={chart.kind}>
      <figcaption>{chart.title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${chart.title}. ${chart.notes.join('. ')}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <title>{chart.title}</title>
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              className="grid"
              x1={PAD.l}
              x2={W - PAD.r}
              y1={sy(t)}
              y2={sy(t)}
            />
            <text className="tick" x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">
              {fmtTick(t, yHi - yLo)}
            </text>
          </g>
        ))}

        {secondary && (
          <g className="exposure">
            {secondary.points.map((p, i) => (
              <rect
                key={`e${i}`}
                x={sx(p.x) - secW / 2}
                y={secY(p.y)}
                width={secW}
                height={Math.max(PAD.t + plotH - secY(p.y), 0)}
              >
                <title>{`${secondary.label} ${p.label ?? p.x}: ${p.y.toFixed(1)}`}</title>
              </rect>
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

        {primary.map((s, si) => {
          const c = color(s, si);
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
                      >
                        <title>{`${s.label} ${p.label ?? p.x}: ${p.y.toFixed(3)}`}</title>
                      </rect>
                      {/* a decomposition is unreadable without its numbers,
                          and the small bars are the ones worth reading */}
                      {chart.kind === 'segment_effects' && (
                        <text
                          className="val"
                          x={sx(p.x) + off + barW / 2}
                          y={(p.y >= 1 ? Math.min(top, base) - 4 : Math.max(top, base) + 11)}
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
                  <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.2} fill={c}>
                    <title>{`${s.label} ${p.label ?? p.x}: ${p.y.toFixed(3)}`}</title>
                  </circle>
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
              id={`${uid}-${si}`}
            />
          );
        })}

        {xTicks.map((t, i) => (
          <text
            key={`x${i}`}
            className="tick"
            x={longLabels ? 0 : sx(t.x)}
            y={longLabels ? 0 : H - PAD.b + 15}
            transform={
              longLabels
                ? `translate(${sx(t.x)} ${H - PAD.b + 13}) rotate(-32)`
                : undefined
            }
            textAnchor={longLabels ? 'end' : 'middle'}
          >
            {t.label}
          </text>
        ))}
        <text className="axis" x={PAD.l} y={H - 4}>
          {chart.xLabel}
        </text>
        <text
          className="axis"
          x={0}
          y={0}
          transform={`translate(11 ${PAD.t + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {chart.yLabel}
        </text>
      </svg>

      <div className="legend">
        {chart.series.map((s, i) => (
          <span key={s.label}>
            <i
              data-style={s.style}
              style={{
                background: isSecondary(s.label)
                    ? 'var(--chart-exposure)'
                    : color(s, primary.indexOf(s) >= 0 ? primary.indexOf(s) : i),
              }}
            />
            {s.label}
          </span>
        ))}
      </div>
      <ul className="notes">
        {chart.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {plain && <div className="gloss">{chart.gloss}</div>}
    </figure>
  );
}
