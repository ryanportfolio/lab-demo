// Every chart an experiment's evidence yields, derived the same way wherever
// the list is needed: the evidence panel's tabs and the studio's navigator.

import type { Evidence, EvidenceChart } from './api';

export const chartKey = (chart: EvidenceChart) => `${chart.kind}:${chart.title}`;

export function liftChart(ev: Evidence): EvidenceChart | null {
  if (!ev.lift.length) return null;
  const pts = (pick: (bucket: Evidence['lift'][number]) => number) =>
    ev.lift.map((bucket) => ({
      x: bucket.decile,
      y: pick(bucket),
      label: String(bucket.decile),
    }));
  const first = ev.lift[0];
  const last = ev.lift[ev.lift.length - 1];
  const ratio = (lo: number, hi: number) => (lo > 0 ? hi / lo : 0);
  return {
    kind: 'lift',
    title: 'Actual frequency by risk decile',
    xLabel: 'Decile of predicted rate, equal exposure',
    yLabel: 'Claims per car year',
    series: [
      { label: 'Earned exposure', style: 'bar', points: pts((bucket) => bucket.exposure) },
      { label: 'Actual, this model', style: 'bar', points: pts((bucket) => bucket.actual) },
      { label: 'Predicted', style: 'line', points: pts((bucket) => bucket.predicted) },
      {
        label: 'Actual, v12 deciles',
        style: 'dot',
        points: pts((bucket) => bucket.baselineActual),
      },
    ],
    notes: [
      `Top decile against bottom decile: ${ratio(first.actual, last.actual).toFixed(2)}x here, ${ratio(first.baselineActual, last.baselineActual).toFixed(2)}x on v12`,
      'Buckets hold equal earned exposure, so bar heights compare directly',
    ],
    gloss:
      'Policies are ordered by predicted risk, split into ten equal-exposure groups, and checked against what actually happened.',
  };
}

export function foldChart(ev: Evidence): EvidenceChart | null {
  if (!ev.foldDeltas.length) return null;
  const held = ev.foldDeltas.filter((delta) => delta > 0).length;
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
        points: ev.foldDeltas.map((delta, index) => ({
          x: index + 1,
          y: delta,
          label: String(index + 1),
        })),
      },
    ],
    notes: [
      `${held} of ${ev.foldDeltas.length} folds land above zero, weakest ${worst >= 0 ? '+' : ''}${worst.toFixed(3)}`,
      'Each fold refits the baseline and variant on the same rows',
    ],
    gloss:
      'The comparison is rerun across held-back slices. A gain that survives every slice is less likely to be noise.',
  };
}

export function normalizeChart(chart: EvidenceChart): EvidenceChart[] {
  if (chart.kind !== 'missingness' || chart.series.length < 2) return [chart];
  const regional = chart.series.find((series) => series.label === 'Missing share by region');
  const frequency = chart.series.find((series) => series.label === 'Frequency by mileage status');
  if (!regional || !frequency) return [chart];
  return [
    {
      ...chart,
      title: 'Missing mileage by region',
      xLabel: 'Region',
      yLabel: 'Policies missing mileage, percent',
      series: [regional],
      notes: chart.notes.slice(0, 1),
    },
    {
      ...chart,
      kind: 'missing_frequency',
      title: 'Frequency by mileage status',
      xLabel: 'Mileage status',
      yLabel: 'Claims per car year',
      series: [frequency],
      notes: chart.notes.slice(1),
    },
  ];
}

export function chartsFromEvidence(evidence: Evidence): EvidenceChart[] {
  const next = evidence.charts.flatMap(normalizeChart);
  const lift = liftChart(evidence);
  const folds = foldChart(evidence);
  if (lift) next.push(lift);
  if (folds) next.push(folds);
  return next;
}
