import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AskChat from './AskChat';
import Chart, { fmtVal } from './Chart';
import {
  fetchEvidence,
  type Evidence,
  type EvidenceChart,
  type Experiment,
} from './api';
import { chartKey, chartsFromEvidence } from './evidenceCharts';
import { fmtDelta, fmtGini } from './format';
import StudioNav from './StudioNav';
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
  savedIds,
  onCite,
  askReady = false,
  experiments,
  navTarget,
  onStudioNavigate,
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
  /** ids already carried into review, so a saved reading can say so */
  savedIds?: string[];
  /** citation navigation out of the docked rail (reveal an experiment) */
  onCite?: (code: string) => void;
  /** the run has finished, so the docked rail's questions are open */
  askReady?: boolean;
  /** the whole run's experiments; enables the studio's chart navigator */
  experiments?: Experiment[];
  /** a chart the studio navigator asked for; the nonce fires the switch */
  navTarget?: { code: string; kind: string; nonce: number } | null;
  /** studio-internal navigation: swap experiment and chart, keep the studio open */
  onStudioNavigate?: (code: string, kind: string) => void;
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
  // Below this width the full view has no room for the docked Ask rail, so
  // chart asks fall back to the ⌘K palette (lab-tuned, 2026-08-09)
  const RAIL_MIN_WIDTH = 1080;
  const [railWide, setRailWide] = useState(() => window.innerWidth >= RAIL_MIN_WIDTH);
  const [fullOpen, setFullOpen] = useState(
    () => new URLSearchParams(location.search).get('full') === '1',
  );
  const [railSeed, setRailSeed] = useState<AgentAsk | null>(null);

  useEffect(() => {
    const onResize = () => setRailWide(window.innerWidth >= RAIL_MIN_WIDTH);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // External experiment switches (ledger click, citation travel) close the
  // studio — those paths clear full from the URL first. Navigator switches
  // keep full=1, so the studio stays up and only the pane swaps. Compare
  // against the previous code rather than skipping the first effect run,
  // because StrictMode double-invokes mount effects in dev.
  const prevCode = useRef(code);
  useEffect(() => {
    if (prevCode.current === code) return;
    prevCode.current = code;
    if (new URLSearchParams(location.search).get('full') === '1') return;
    setFullOpen(false);
    setRailSeed(null);
  }, [code]);

  const setFull = useCallback((next: boolean) => {
    setFullOpen(next);
    if (!next) setRailSeed(null);
    updateEvidenceUrl({ full: next });
  }, []);

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

  const charts = useMemo(() => (evidence ? chartsFromEvidence(evidence) : []), [evidence]);
  const shownCode = evidence?.code ?? code;
  const activeChart = charts.find((chart) => chartKey(chart) === activeKey) ?? charts[0];
  const displayedChart = activeChart
    ? displayChart(activeChart, contractFor(activeChart), mode)
    : undefined;

  // Apply a navigator switch once its experiment's charts are on hand. The
  // nonce distinguishes a fresh click from a target already applied.
  const appliedNav = useRef(0);
  useEffect(() => {
    if (!navTarget || navTarget.nonce === appliedNav.current) return;
    if (shownCode !== navTarget.code || !charts.length) return;
    appliedNav.current = navTarget.nonce;
    const target = charts.find((chart) => chart.kind === navTarget.kind) ?? charts[0];
    resolve(() => {
      setActiveKey(chartKey(target));
      setMode(contractFor(target).defaultMode);
      setSelection(null);
    });
  }, [navTarget, charts, shownCode, resolve]);

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
                        // On a wide screen an ask opens the split studio with
                        // the question seeded beside the chart; narrow screens
                        // keep the palette
                        onAsk: (ask) => {
                          if (railWide) {
                            setRailSeed(ask);
                            setFull(true);
                          } else {
                            onAsk(ask);
                          }
                        },
                        onSave,
                        savedIds,
                      }
                    : undefined
                }
                expanded={fullOpen}
                onExpandedChange={setFull}
                sideNav={
                  railWide && experiments && onStudioNavigate ? (
                    <StudioNav
                      runId={runId}
                      experiments={experiments}
                      activeCode={shownCode}
                      activeKind={activeChart?.kind ?? null}
                      onNavigate={onStudioNavigate}
                    />
                  ) : undefined
                }
                askRail={
                  railWide && onAsk && onSave ? (
                    <>
                      <div className="ask-bar">
                        <span className="ask-mark" aria-hidden="true">AI</span>
                        <h2>Ask about this run</h2>
                      </div>
                      <AskChat
                        runId={runId}
                        ready={askReady}
                        plain={plain}
                        open={fullOpen}
                        seed={railSeed}
                        threadKey={runId}
                        onCite={(citedCode) => {
                          setFull(false);
                          onCite?.(citedCode);
                        }}
                      />
                    </>
                  ) : undefined
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
