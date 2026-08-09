import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chart, { fmtVal } from './Chart';
import {
  fetchEvidence,
  type Evidence,
  type EvidenceChart,
  type Experiment,
} from './api';
import { fmtDelta, fmtGini } from './format';
import {
  contractFor,
  displayChart,
  normalizeSelection,
  parseSelection,
  selectionForChart,
  updateEvidenceUrl,
  weakestSelection,
  type AgentAsk,
  type ChartMode,
  type ChartSelection,
  type SavedChartEvidence,
} from './chartWorkspace';

function liftChart(ev: Evidence): EvidenceChart | null {
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

function foldChart(ev: Evidence): EvidenceChart | null {
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

const chartKey = (chart: EvidenceChart) => `${chart.kind}:${chart.title}`;

function normalizeChart(chart: EvidenceChart): EvidenceChart[] {
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

function tabLabel(chart: EvidenceChart): string {
  const labels: Record<string, string> = {
    age_curve: 'Age',
    segment_effects: 'Segments',
    territory: 'Territory',
    lift: 'Separation',
    folds: 'Folds',
    missingness: 'Missingness',
    missing_frequency: 'Frequency',
  };
  return labels[chart.kind] ?? chart.title.replace(/^Change in /, '').split(' by ')[0];
}

function ExactValues({
  chart,
  selection,
}: {
  chart: EvidenceChart;
  selection: ChartSelection | null;
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

  const selected = selection ? normalizeSelection(selection) : null;

  return (
    <details className="exact-values">
      <summary>Exact values</summary>
      <div className="exact-scroll">
        <table>
          <thead>
            <tr>
              <th>{chart.xLabel}</th>
              {chart.series.map((series) => (
                <th key={series.label}>{series.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {xValues.map((x) => (
              <tr
                key={x}
                className={selected && x >= selected.start && x <= selected.end ? 'is-selected' : undefined}
              >
                <th>{labels.get(x) ?? fmtVal(x)}</th>
                {chart.series.map((series) => {
                  const point = series.points.find((item) => Math.abs(item.x - x) < 1e-9);
                  return <td key={series.label}>{point ? fmtVal(point.y) : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function EvidencePanel({
  runId,
  code,
  plain,
  experiment,
  focused = false,
  onAsk,
  onSave,
  baseVersion = 12,
  weakFocus,
}: {
  runId: string;
  code: string;
  plain: boolean;
  experiment?: Experiment;
  focused?: boolean;
  onAsk?: (ask: AgentAsk) => void;
  onSave?: (evidence: SavedChartEvidence) => void;
  /** version of the model this run branched from, stamped on evidence context */
  baseVersion?: number;
  /**
   * A request to jump to the chart the weak-point prose talks about and pin
   * its thinnest slice. The text picks the chart; the nonce fires the jump.
   */
  weakFocus?: { text: string; nonce: number };
}) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [shownExperiment, setShownExperiment] = useState<Experiment | undefined>(experiment);
  const [state, setState] = useState<'loading' | 'refreshing' | 'ready' | 'empty' | 'error' | 'stale'>('loading');
  const [activeKey, setActiveKey] = useState('');
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [mode, setMode] = useState<ChartMode>('level');
  const [retry, setRetry] = useState(0);
  const [resolving, setResolving] = useState(false);
  const resolveTimer = useRef<number | null>(null);

  const resolve = useCallback((update: () => void) => {
    const staticFrame =
      document.documentElement.classList.contains('no-anim') ||
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (resolveTimer.current != null) window.clearTimeout(resolveTimer.current);
    if (staticFrame) {
      update();
      setResolving(false);
      return;
    }
    setResolving(true);
    resolveTimer.current = window.setTimeout(() => {
      update();
      setResolving(false);
      resolveTimer.current = null;
    }, 110);
  }, []);

  useEffect(
    () => () => {
      if (resolveTimer.current != null) window.clearTimeout(resolveTimer.current);
    },
    [],
  );

  useEffect(() => {
    let live = true;
    const hasCurrentArtifact = evidence != null;
    setState(hasCurrentArtifact ? 'refreshing' : 'loading');
    if (!hasCurrentArtifact) setShownExperiment(experiment);
    fetchEvidence(runId, code)
      .then((result) => {
        if (!live) return;
        const update = () => {
          setActiveKey('');
          setSelection(null);
          setMode('level');
          setEvidence(result);
          setShownExperiment(experiment);
          setState(result ? 'ready' : 'empty');
        };
        if (hasCurrentArtifact) resolve(update);
        else update();
      })
      .catch(() => {
        if (!live) return;
        setState(hasCurrentArtifact ? 'stale' : 'error');
      });
    return () => {
      live = false;
    };
  }, [runId, code, retry]);

  const charts = useMemo(() => {
    if (!evidence) return [];
    const next = evidence.charts.flatMap(normalizeChart);
    const lift = liftChart(evidence);
    const folds = foldChart(evidence);
    if (lift) next.push(lift);
    if (folds) next.push(folds);
    return next;
  }, [evidence]);
  const shownCode = evidence?.code ?? code;
  const activeChart = charts.find((chart) => chartKey(chart) === activeKey) ?? charts[0];
  const displayedChart = activeChart
    ? displayChart(activeChart, contractFor(activeChart), mode)
    : undefined;

  // Jump to the weak point's own chart. The chart is picked by matching the
  // weak-point prose against chart words, not by position, so the same button
  // stays honest if a different experiment wins a future run. Word overlap is
  // scored because one stray shared word (say "relativity") must not beat the
  // chart the sentence is actually about.
  const appliedWeakFocus = useRef(0);
  useEffect(() => {
    if (!weakFocus || weakFocus.nonce === appliedWeakFocus.current || !charts.length) return;
    appliedWeakFocus.current = weakFocus.nonce;
    const prose = weakFocus.text.toLowerCase();
    const score = (chart: EvidenceChart) =>
      Array.from(new Set(`${chart.title} ${chart.xLabel}`.toLowerCase().split(/\W+/)))
        .filter((word) => word.length > 4)
        .filter((word) => prose.includes(word)).length;
    const focusable = charts.filter((chart) => weakestSelection(chart));
    if (!focusable.length) return;
    const target = focusable.reduce((best, chart) => (score(chart) > score(best) ? chart : best));
    const pinned = weakestSelection(target)!;
    resolve(() => {
      setActiveKey(chartKey(target));
      setMode(contractFor(target).defaultMode);
      setSelection(pinned);
    });
    updateEvidenceUrl({ exp: shownCode, chart: target.kind, mode: null, selection: pinned });
  }, [weakFocus, charts, shownCode, resolve]);

  useEffect(() => {
    if (!charts.length || activeKey) return;
    const params = new URLSearchParams(location.search);
    const requestedKind = params.get('exp') === shownCode ? params.get('chart') : null;
    const requested = charts.find((chart) => chart.kind === requestedKind) ?? charts[0];
    const contract = contractFor(requested);
    const requestedMode = params.get('mode');
    setActiveKey(chartKey(requested));
    setMode(
      requestedKind && (requestedMode === 'change' || requestedMode === 'level')
        ? requestedMode === 'change' && contract.comparison
          ? 'change'
          : 'level'
        : contract.defaultMode,
    );
    if (requestedKind) {
      setSelection(selectionForChart(requested, parseSelection(params.get('sel')), contract.range));
    }
  }, [activeKey, charts, shownCode]);

  if (state === 'loading') {
    return (
      <div className="evidence evidence-state" aria-busy="true">
        <span className="eyebrow">Evidence</span>
        Reading {code} artifacts
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="evidence evidence-state" role="alert">
        <span>{code} artifacts did not load</span>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>
      </div>
    );
  }
  if (!evidence) {
    return (
      <div className="evidence evidence-state">
        <span className="eyebrow">Evidence</span>
        Stopped before fit
      </div>
    );
  }

  return (
    <article
      className={`evidence evidence-focus${focused ? ' is-focused' : ''}${resolving ? ' is-resolving' : ''}`}
      aria-busy={state === 'refreshing'}
    >
      {state === 'refreshing' && (
        <span className="evidence-pending" aria-live="polite">Loading {code}</span>
      )}
      {state === 'stale' && (
        <button
          type="button"
          className="evidence-pending evidence-stale"
          onClick={() => setRetry((value) => value + 1)}
          aria-live="polite"
        >
          {code} failed · showing {shownCode} · Retry
        </button>
      )}
      <div className="evidence-resolve">
        <header className="evidence-head">
          <div>
            <span className="eyebrow">Selected evidence · {shownCode}</span>
            <h2>{shownExperiment?.name ?? shownCode}</h2>
          </div>
          {shownExperiment && (
            <div className={`evidence-verdict ${shownExperiment.status}`}>
              <strong>
                {shownExperiment.deltaGini != null
                  ? fmtDelta(shownExperiment.deltaGini)
                  : shownExperiment.verdictTag}
              </strong>
              <span>{shownExperiment.verdictText ?? shownExperiment.status}</span>
            </div>
          )}
        </header>

        {evidence.facts ? (
          <div className="facts" aria-label="Fit facts">
            <span><b>{evidence.facts.rows.toLocaleString('en-US')}</b> rows</span>
            <span><b>{evidence.facts.params}</b> params</span>
            <span><b>{evidence.facts.iterations}</b> iterations</span>
            <span>Gini <b>{fmtGini(evidence.facts.gini)}</b></span>
            <span>AIC <b>{evidence.facts.aic.toFixed(0)}</b></span>
          </div>
        ) : (
          <div className="facts facts-unfit" aria-label="Fit facts">
            <span><b>Pre-fit</b> artifact</span>
            <span>Model fit not run</span>
          </div>
        )}

        {charts.length > 0 && (
          <div className="evidence-tabs" role="tablist" aria-label={`${shownCode} evidence views`}>
            {charts.map((chart) => {
              const key = chartKey(chart);
              const current = activeChart && chartKey(activeChart) === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  onClick={() => {
                    resolve(() => {
                      setActiveKey(key);
                      setSelection(null);
                      setMode(contractFor(chart).defaultMode);
                    });
                    updateEvidenceUrl({
                      exp: shownCode,
                      chart: chart.kind,
                      mode: null,
                      selection: null,
                    });
                  }}
                >
                  {tabLabel(chart)}
                </button>
              );
            })}
          </div>
        )}

        {activeChart ? (
          <>
            <div className="focused-chart" role="tabpanel">
              <Chart
                chart={activeChart}
                plain={plain}
                selection={selection}
                mode={mode}
                onSelectionChange={(next) => {
                  setSelection(next);
                  updateEvidenceUrl({
                    exp: shownCode,
                    chart: activeChart.kind,
                    mode: mode === contractFor(activeChart).defaultMode ? null : mode,
                    selection: next,
                  });
                }}
                onModeChange={(next) => {
                  setMode(next);
                  updateEvidenceUrl({
                    exp: shownCode,
                    chart: activeChart.kind,
                    mode: next === contractFor(activeChart).defaultMode ? null : next,
                    selection,
                  });
                }}
                context={
                  onAsk && onSave
                    ? {
                        runId,
                        code: shownCode,
                        target: 'BI claims',
                        denominator: 'earned car year',
                        model: `v${baseVersion} candidate comparison`,
                        baseVersion,
                        onAsk,
                        onSave,
                      }
                    : undefined
                }
              />
            </div>
            <div className="evidence-source">
              <span>{shownCode} · run {runId}</span>
              <span>{activeChart.xLabel} / {activeChart.yLabel}</span>
            </div>
            <ExactValues chart={displayedChart ?? activeChart} selection={selection} />
          </>
        ) : (
          <div className="evidence-state">No chart artifact for this stopped experiment</div>
        )}
      </div>
    </article>
  );
}
