// Frontier chart, hand-rolled SVG like the design spec but plotted from the
// run's real numbers. The blue path traces the best guardrail-clean trade at
// each factor spend; dots that would sit under the baseline dot get a small
// jitter offset so nothing hides (the flat-lift family case).

import type { Experiment } from './api';

const W = 256;
const H = 190;
const ML = 40;
const MR = 10;
const MT = 14;
const MB = 34;

interface Props {
  experiments: Experiment[];
  baselineGini: number | null;
  complete: boolean;
  winnerCode: string | null;
  hovered: string | null;
}

export default function Frontier({
  experiments,
  baselineGini,
  complete,
  winnerCode,
  hovered,
}: Props) {
  const base = baselineGini;
  const landed = experiments.filter(
    (e) => e.gini != null && e.budgetUsed != null,
  );

  const ginis = [base ?? 0.2, ...landed.map((e) => e.gini!)];
  const lo = Math.min(...ginis) - 0.004;
  const hi = Math.max(...ginis) + 0.004;
  const maxSpend = 3;
  const fx = (v: number) => ML + (v / maxSpend) * (W - ML - MR);
  const fy = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB);

  // y gridlines on rounded 0.01 steps inside the domain
  const gridVals: number[] = [];
  for (let v = Math.ceil(lo * 100) / 100; v <= hi + 1e-9; v += 0.01) {
    gridVals.push(Math.round(v * 100) / 100);
  }

  // frontier path: best eligible gini at each spend level, monotone
  const eligible = landed.filter((e) =>
    ['candidate', 'winner', 'absorbed'].includes(e.status),
  );
  const path: { x: number; y: number }[] = [];
  if (base != null) {
    path.push({ x: 0, y: base });
    let best = base;
    for (let s = 1; s <= maxSpend; s++) {
      const cands = eligible.filter(
        (e) => e.budgetUsed! <= s && e.gini! > best,
      );
      if (cands.length) {
        best = Math.max(...cands.map((e) => e.gini!));
        path.push({ x: s, y: best });
      }
    }
  }

  // jitter dots that would overlap the baseline dot
  const jitter = (e: Experiment) =>
    base != null &&
    e.budgetUsed === 0 &&
    Math.abs(e.gini! - base) < (hi - lo) * 0.02
      ? 7
      : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Gini against added factors. Each experiment lands as a dot when it fits. The winner sits highest."
    >
      <g className="axis">
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={ML} x2={W - MR} y1={fy(v)} y2={fy(v)} className="gridline" />
            <text x={ML - 5} y={fy(v) + 3} textAnchor="end">
              {v.toFixed(2)}
            </text>
          </g>
        ))}
        {[0, 1, 2, 3].map((v) => (
          <text key={v} x={fx(v)} y={H - MB + 13} textAnchor="middle">
            {v}
          </text>
        ))}
        <text x={ML} y={MT - 4} className="lbl">
          Gini
        </text>
        <text x={(ML + W - MR) / 2} y={H - 6} textAnchor="middle" className="lbl">
          factor budget used
        </text>
      </g>
      {path.length > 1 && (
        <path
          className={`fpath${complete ? ' on' : ''}`}
          d={path.map((p, i) => `${i === 0 ? 'M' : 'L'}${fx(p.x)},${fy(p.y)}`).join('')}
        />
      )}
      {base != null && (
        <>
          <circle cx={fx(0)} cy={fy(base)} r={3.5} className="fdot base on" />
          <text
            x={fx(0) + 6}
            y={fy(base) + 10}
            style={{
              fontSize: 9,
              fill: 'var(--fg-subtle)',
              fontFamily: 'var(--mono)',
            }}
          >
            v12
          </text>
        </>
      )}
      {landed.map((e) => (
        <circle
          key={e.code}
          cx={fx(e.budgetUsed!) + jitter(e)}
          cy={fy(e.gini!)}
          r={hovered === e.code ? 5 : 3.5}
          className={`fdot on ${e.status === 'scrapped' ? 'scrap' : 'cand'}`}
        />
      ))}
      {complete &&
        winnerCode &&
        landed
          .filter((e) => e.code === winnerCode)
          .map((e) => (
            <circle
              key="ring"
              cx={fx(e.budgetUsed!)}
              cy={fy(e.gini!)}
              r={7}
              className="fring on"
            />
          ))}
    </svg>
  );
}
