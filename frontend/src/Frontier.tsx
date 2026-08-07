// A linked experiment map drawn from the live run. Position carries model
// separation and factor cost. Shape carries disposition. Selection is shared
// with the ledger so the chart is never the only route into the evidence.

import type { KeyboardEvent } from 'react';
import type { Experiment } from './api';

const W = 620;
const H = 330;
const ML = 62;
const MR = 26;
const MT = 28;
const MB = 54;
const MAX_SPEND = 2;

interface Props {
  experiments: Experiment[];
  baselineGini: number | null;
  complete: boolean;
  winnerCode: string | null;
  hovered: string | null;
  selectedCode: string | null;
  onSelect: (code: string) => void;
}

function activate(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export default function Frontier({
  experiments,
  baselineGini,
  complete,
  winnerCode,
  hovered,
  selectedCode,
  onSelect,
}: Props) {
  const base = baselineGini;
  const landed = experiments.filter(
    (e) => e.status !== 'running' && e.gini != null && e.budgetUsed != null,
  );
  const skipped = experiments.filter(
    (e) => e.status !== 'running' && e.gini == null,
  );

  const ginis = [base ?? 0.2, ...landed.map((e) => e.gini!)];
  const lo = Math.min(...ginis) - 0.003;
  const hi = Math.max(...ginis) + 0.003;
  const fx = (v: number) => ML + (v / MAX_SPEND) * (W - ML - MR);
  const fy = (v: number) => MT + (1 - (v - lo) / (hi - lo)) * (H - MT - MB);

  const gridVals: number[] = [];
  for (let v = Math.ceil(lo * 200) / 200; v <= hi + 1e-9; v += 0.005) {
    gridVals.push(Math.round(v * 1000) / 1000);
  }

  const eligible = landed.filter((e) =>
    ['candidate', 'winner', 'absorbed'].includes(e.status),
  );
  const path: { x: number; y: number }[] = [];
  if (base != null) {
    path.push({ x: 0, y: base });
    let best = base;
    for (let spend = 1; spend <= MAX_SPEND; spend++) {
      const candidates = eligible.filter(
        (e) => e.budgetUsed! <= spend && e.gini! > best,
      );
      if (candidates.length) {
        best = Math.max(...candidates.map((e) => e.gini!));
        path.push({ x: spend, y: best });
      }
    }
  }

  const offsets: Record<string, { x: number; y: number }> = {
    'EXP-01': { x: -40, y: -5 },
    'EXP-02': { x: 18, y: 18 },
    'EXP-03': { x: -12, y: -8 },
    'EXP-04': { x: 40, y: 8 },
    'EXP-05': { x: 14, y: 17 },
    'EXP-07': { x: 0, y: 0 },
  };
  const point = (experiment: Experiment) => ({
    x: fx(experiment.budgetUsed ?? 0) + (offsets[experiment.code]?.x ?? 0),
    y: fy(experiment.gini ?? base ?? lo) + (offsets[experiment.code]?.y ?? 0),
  });

  const parentOne = landed.find((e) => e.code === 'EXP-01');
  const parentFour = landed.find((e) => e.code === 'EXP-04');
  const winner = landed.find((e) => e.code === 'EXP-07');

  return (
    <div className="frontier-wrap">
      <div className="frontier-key" aria-label="Experiment state legend">
        <span data-state="candidate"><i />Candidate</span>
        <span data-state="scrapped"><i />Scrapped</span>
        <span data-state="winner"><i />Winner</span>
      </div>
      <svg
        className="frontier-map"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Gini against added rating factors. Select an experiment to inspect its evidence. EXP-01 and EXP-04 combine into EXP-07."
      >
        <g className="axis">
          {gridVals.map((value) => (
            <g key={value}>
              <line x1={ML} x2={W - MR} y1={fy(value)} y2={fy(value)} className="gridline" />
              <text x={ML - 9} y={fy(value) + 4} textAnchor="end">
                {value.toFixed(3)}
              </text>
            </g>
          ))}
          {[0, 1, 2].map((value) => (
            <g key={value}>
              <line x1={fx(value)} x2={fx(value)} y1={MT} y2={H - MB} className="gridline vertical" />
              <text x={fx(value)} y={H - MB + 21} textAnchor="middle">
                {value}
              </text>
            </g>
          ))}
          <text x={ML} y={MT - 10} className="lbl">Gini</text>
          <text x={W - MR} y={H - 10} textAnchor="end" className="lbl">factor budget used</text>
        </g>

        {path.length > 1 && (
          <path
            className={`fpath${complete ? ' on' : ''}`}
            d={path.map((p, index) => `${index === 0 ? 'M' : 'L'}${fx(p.x)},${fy(p.y)}`).join('')}
          />
        )}

        {winner && parentOne && parentFour && (
          <g className="lineage-path" aria-hidden="true">
            <path d={`M${point(parentOne).x},${point(parentOne).y} C${fx(1.45)},${point(parentOne).y} ${fx(1.55)},${point(winner).y} ${point(winner).x},${point(winner).y}`} />
            <path d={`M${point(parentFour).x},${point(parentFour).y} C${fx(1.45)},${point(parentFour).y} ${fx(1.55)},${point(winner).y} ${point(winner).x},${point(winner).y}`} />
          </g>
        )}

        {base != null && (
          <g className="baseline-point">
            <circle cx={fx(0)} cy={fy(base)} r={4.5} />
            <text x={fx(0) + 9} y={fy(base) - 9}>v12</text>
          </g>
        )}

        {landed.map((experiment) => {
          const p = point(experiment);
          const selected = selectedCode === experiment.code;
          const highlighted = hovered === experiment.code;
          const status = experiment.status === 'absorbed' ? 'candidate' : experiment.status;
          return (
            <g
              key={experiment.code}
              className={`frontier-node state-${status}${selected ? ' selected' : ''}${highlighted ? ' hovered' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${experiment.code} ${experiment.name}. ${experiment.verdictTag}: ${experiment.verdictText}`}
              aria-pressed={selected}
              onClick={() => onSelect(experiment.code)}
              onKeyDown={(event) => activate(event, () => onSelect(experiment.code))}
            >
              <title>{experiment.code}: {experiment.name}. Select for evidence.</title>
              <circle className="node-target" cx={p.x} cy={p.y} r="38" />
              <circle className="node-hit" cx={p.x} cy={p.y} r="20" />
              {status === 'scrapped' ? (
                <path className="node-shape" d={`M${p.x - 6.5},${p.y - 6.5} L${p.x + 6.5},${p.y + 6.5} M${p.x + 6.5},${p.y - 6.5} L${p.x - 6.5},${p.y + 6.5}`} />
              ) : status === 'winner' ? (
                <rect className="node-shape" x={p.x - 7} y={p.y - 7} width="14" height="14" transform={`rotate(45 ${p.x} ${p.y})`} />
              ) : (
                <circle className="node-shape" cx={p.x} cy={p.y} r="7.5" />
              )}
              <text className="node-code" x={p.x + 14} y={p.y + (experiment.code === 'EXP-02' ? 20 : -13)}>
                {experiment.code.replace('EXP-', '')}
              </text>
            </g>
          );
        })}

        {skipped.map((experiment, index) => {
          const x = fx(experiment.budgetUsed ?? 1) + index * 42;
          const y = H - MB + 4;
          const selected = selectedCode === experiment.code;
          return (
            <g
              key={experiment.code}
              className={`frontier-node state-scrapped skipped${selected ? ' selected' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${experiment.code} ${experiment.name}. Fit skipped. ${experiment.verdictText}`}
              aria-pressed={selected}
              onClick={() => onSelect(experiment.code)}
              onKeyDown={(event) => activate(event, () => onSelect(experiment.code))}
            >
              <title>{experiment.code}: {experiment.name}. Select for refusal evidence.</title>
              <circle className="node-target" cx={x} cy={y} r="38" />
              <circle className="node-hit" cx={x} cy={y} r="20" />
              <path className="node-shape" d={`M${x - 6.5},${y - 6.5} L${x + 6.5},${y + 6.5} M${x + 6.5},${y - 6.5} L${x - 6.5},${y + 6.5}`} />
              <text className="node-code" x={x + 14} y={y + 4}>{experiment.code.replace('EXP-', '')} · not fit</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
