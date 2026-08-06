// What sits behind a verdict. Opened from an experiment card, loaded on
// demand rather than on every poll, because a run polls four times a second.

import { useEffect, useState } from 'react';
import Chart from './Chart';
import { fetchEvidence, type Evidence, type EvidenceChart } from './api';
import { fmtGini } from './format';

function liftChart(ev: Evidence): EvidenceChart | null {
  if (!ev.lift.length) return null;
  const pts = (pick: (b: Evidence['lift'][number]) => number) =>
    ev.lift.map((b) => ({ x: b.decile, y: pick(b), label: String(b.decile) }));
  const first = ev.lift[0];
  const last = ev.lift[ev.lift.length - 1];
  const ratio = (lo: number, hi: number) => (lo > 0 ? hi / lo : 0);
  return {
    kind: 'lift',
    title: 'Actual frequency by risk decile',
    xLabel: 'Decile of predicted rate, equal exposure',
    yLabel: 'Claims per car year',
    series: [
      { label: 'Actual, this model', style: 'bar', points: pts((b) => b.actual) },
      { label: 'Predicted', style: 'line', points: pts((b) => b.predicted) },
      {
        label: 'Actual, v12 deciles',
        style: 'dot',
        points: pts((b) => b.baselineActual),
      },
    ],
    notes: [
      `Top decile against bottom decile: ${ratio(first.actual, last.actual).toFixed(2)}x here, ${ratio(first.baselineActual, last.baselineActual).toFixed(2)}x on v12`,
      'Buckets hold equal earned exposure, so bar heights compare directly',
    ],
    gloss:
      'Drivers are lined up from the ones this model thinks are safest to the ones it thinks are riskiest, then cut into ten equal groups. The bars are what each group actually claimed, so a staircase that climbs means the model is sorting real risk.',
  };
}

function foldChart(ev: Evidence): EvidenceChart | null {
  if (!ev.foldDeltas.length) return null;
  const held = ev.foldDeltas.filter((d) => d > 0).length;
  const worst = Math.min(...ev.foldDeltas);
  return {
    kind: 'folds',
    title: 'Change in separation by fold',
    xLabel: 'Cross validation fold',
    yLabel: 'Change in Gini against v12',
    series: [
      {
        label: 'Fold delta',
        style: 'bar',
        points: ev.foldDeltas.map((d, i) => ({
          x: i + 1,
          y: d,
          label: String(i + 1),
        })),
      },
    ],
    notes: [
      `${held} of ${ev.foldDeltas.length} folds land above zero, and the weakest reads ${worst >= 0 ? '+' : ''}${worst.toFixed(3)}`,
      'Each fold refits the baseline and the variant on the same rows, so the pair is comparable',
    ],
    gloss:
      'The data is cut into five slices and the whole comparison is rerun five times, each time holding one slice back. A gain that shows up on every slice is a gain, and one that shows up on some is noise.',
  };
}

export default function EvidencePanel({
  runId,
  code,
  plain,
}: {
  runId: string;
  code: string;
  plain: boolean;
}) {
  const [ev, setEv] = useState<Evidence | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading',
  );

  useEffect(() => {
    let live = true;
    setState('loading');
    fetchEvidence(runId, code)
      .then((e) => {
        if (!live) return;
        setEv(e);
        setState(e ? 'ready' : 'empty');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
  }, [runId, code]);

  if (state === 'loading') {
    return (
      <div className="evidence loading" aria-busy="true">
        Reading the artifacts for {code}
      </div>
    );
  }
  if (state === 'error') {
    return <div className="evidence">The artifacts for {code} did not load</div>;
  }
  if (!ev) {
    return (
      <div className="evidence">
        This experiment was refused before any fit ran, so it has no fit
        artifacts
      </div>
    );
  }

  const charts = [...ev.charts];
  const lift = liftChart(ev);
  const folds = foldChart(ev);
  if (lift) charts.push(lift);
  if (folds) charts.push(folds);

  return (
    <div className="evidence">
      {ev.facts && (
        <div className="facts">
          <span>
            <b>{ev.facts.rows.toLocaleString('en-US')}</b> training rows
          </span>
          <span>
            <b>{ev.facts.params}</b> parameters
          </span>
          <span>
            IRLS converged in <b>{ev.facts.iterations}</b>{' '}
            {ev.facts.iterations === 1 ? 'iteration' : 'iterations'}
          </span>
          <span>
            Gini <b>{fmtGini(ev.facts.gini)}</b> against{' '}
            {fmtGini(ev.facts.baselineGini)}
          </span>
          <span>
            deviance <b>{ev.facts.deviance.toFixed(0)}</b>
          </span>
          <span>
            AIC <b>{ev.facts.aic.toFixed(0)}</b>
          </span>
          {ev.facts.alpha != null && (
            <span>
              alpha <b>{ev.facts.alpha.toFixed(3)}</b>
            </span>
          )}
        </div>
      )}
      <div className="charts">
        {charts.map((c) => (
          <Chart key={c.kind + c.title} chart={c} plain={plain} />
        ))}
      </div>
    </div>
  );
}
