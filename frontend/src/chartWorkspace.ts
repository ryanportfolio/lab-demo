import type { EvidenceChart, EvidenceSeries } from './api';

export type ChartMode = 'level' | 'change';

export interface ChartSelection {
  start: number;
  end: number;
}

interface Comparison {
  baseline: string;
  candidate: string;
  change: 'absolute' | 'percent';
  label: string;
}

export interface ChartGuardrail {
  low?: number;
  high?: number;
  label: string;
  applies: 'level' | 'change' | 'both';
}

export interface ChartContract {
  question: string;
  range: boolean;
  comparison?: Comparison;
  guardrail?: ChartGuardrail;
  /**
   * The view a chart opens on. Territory answers "how far from filed" — that
   * is the change view with the tolerance band, so it opens there. Everything
   * else opens on level.
   */
  defaultMode: ChartMode;
}

/** Provenance facts a chart companion shows beside the artifact. A view over
 *  `evidence.facts` — no new state; absent fields simply do not render. */
export interface ChartProvenance {
  trainWindow?: string | null;
  holdoutWindow?: string | null;
  trainRows?: number | null;
  trainExposure?: number | null;
  trainClaims?: number | null;
  foldValExposure?: number | null;
  covRidge?: number | null;
}

export interface ChartWorkspaceContext {
  runId: string;
  code: string;
  target: string;
  denominator: string;
  model: string;
  /** version of the model this run branched from */
  baseVersion: number;
  /** provenance facts from the run's evidence, when the surface has them */
  provenance?: ChartProvenance;
  onAsk: (ask: AgentAsk) => void;
  onSave: (evidence: SavedChartEvidence) => void;
  /** ids already carried into review, so a saved reading says so */
  savedIds?: string[];
}

/**
 * An ask carried from a chart selection. The user reads and edits `question`;
 * `context` is the chip naming what rides along; `send` is the full composed
 * text the context expert actually receives when the question is unedited.
 */
export interface AgentAsk {
  question: string;
  context: string;
  send: string;
}

export interface SavedChartEvidence {
  id: string;
  runId: string;
  /** version of the model the run branched from; absent on cards saved
   * before version stamping existed */
  baseVersion?: number;
  code: string;
  chartKind: string;
  title: string;
  question: string;
  selection: string;
  mode: ChartMode;
  values: string[];
  weakPoint: string;
  source: string;
  url: string;
  savedAt: string;
}

const QUESTIONS: Record<string, string> = {
  age_curve: 'How does the fitted age shape differ from v12, and where is exposure thin?',
  accidents: 'Does capped claim history explain observed frequency without pricing sparse counts?',
  territory: 'How far would this experiment move the filed territory table?',
  count_dist: 'Does the alternate family explain the observed claim-count distribution?',
  interaction: 'Does the interaction explain residual frequency in a credible cell?',
  missingness: 'Where is mileage missing most, and which regions need remediation?',
  missing_frequency: 'Do policies with missing mileage have different claim frequency?',
  segment_effects: 'Which rating factors drive this segment away from the book average?',
  lift: 'Does this model separate observed risk better than v12 across risk deciles?',
  folds: 'Does the gain survive every held-back validation fold?',
  slice_age: 'Inside this slice, how does observed frequency move with driver age?',
  slice_accidents: 'Inside this slice, does claim history still separate risk?',
  slice_territory: 'Which territories carry this slice, and at what frequency?',
  slice_region: 'Which regions carry this slice, and at what frequency?',
};

const comparisons: Record<string, Comparison> = {
  age_curve: {
    baseline: 'v12 bands',
    candidate: 'Fitted spline',
    change: 'percent',
    label: '% vs v12',
  },
  accidents: {
    baseline: 'Fitted, capped at 3',
    candidate: 'Observed',
    change: 'absolute',
    label: 'Observed gap',
  },
  territory: {
    baseline: 'Filed',
    candidate: 'Blended',
    change: 'percent',
    label: '% vs filed',
  },
  interaction: {
    baseline: 'Expected without interaction',
    candidate: 'Observed',
    change: 'absolute',
    label: 'Observed gap',
  },
  lift: {
    baseline: 'Actual, v12 deciles',
    candidate: 'Actual, this model',
    change: 'absolute',
    label: 'Frequency vs v12',
  },
};

export const isSecondarySeries = (series: EvidenceSeries | string) => {
  const label = typeof series === 'string' ? series : series.label;
  return label === 'Earned exposure' || label.startsWith('Share of exposure');
};

export function contractFor(chart: EvidenceChart): ChartContract {
  const comparison = comparisons[chart.kind];
  const hasComparison =
    comparison &&
    chart.series.some((series) => series.label === comparison.baseline) &&
    chart.series.some((series) => series.label === comparison.candidate);
  return {
    question: QUESTIONS[chart.kind] ?? `What decision does ${chart.title.toLowerCase()} support?`,
    range: chart.kind === 'age_curve' || chart.kind === 'lift',
    comparison: hasComparison ? comparison : undefined,
    defaultMode: chart.kind === 'territory' && hasComparison ? 'change' : 'level',
    guardrail:
      chart.kind === 'territory'
        ? { low: -5, high: 5, label: 'Filed tolerance ±5%', applies: 'change' }
        : chart.kind === 'folds'
          ? { low: 0, label: 'Must remain above zero', applies: 'level' }
          : undefined,
  };
}

export function displayChart(
  chart: EvidenceChart,
  contract: ChartContract,
  mode: ChartMode,
): EvidenceChart {
  if (mode !== 'change' || !contract.comparison) return chart;
  const baseline = chart.series.find((series) => series.label === contract.comparison!.baseline)!;
  const candidate = chart.series.find((series) => series.label === contract.comparison!.candidate)!;
  const points = candidate.points.flatMap((point) => {
    const base = baseline.points.find((item) => Math.abs(item.x - point.x) < 1e-9);
    if (!base) return [];
    const y =
      contract.comparison!.change === 'percent'
        ? base.y === 0
          ? 0
          : 100 * (point.y / base.y - 1)
        : point.y - base.y;
    // a change view compares two dependent fits on the same rows; the level
    // view's standard errors do not transfer, so the derived series drops them
    return [{ ...point, y, se: null }];
  });
  const weight = chart.series.filter(isSecondarySeries);
  return {
    ...chart,
    yLabel: contract.comparison.label,
    series: [
      ...weight,
      {
        label: contract.comparison.label,
        style: chart.kind === 'territory' || chart.kind === 'lift' ? 'bar' : 'line',
        points,
      },
    ],
  };
}

export function normalizeSelection(selection: ChartSelection): ChartSelection {
  return {
    start: Math.min(selection.start, selection.end),
    end: Math.max(selection.start, selection.end),
  };
}

export function selectionLabel(chart: EvidenceChart, selection: ChartSelection): string {
  const selected = normalizeSelection(selection);
  const labelAt = (x: number) =>
    chart.series
      .flatMap((series) => series.points)
      .find((point) => Math.abs(point.x - x) < 1e-9)?.label ?? String(x);
  const start = labelAt(selected.start);
  const end = labelAt(selected.end);
  return selected.start === selected.end ? start : `${start}–${end}`;
}

export function selectionValues(
  chart: EvidenceChart,
  selection: ChartSelection,
): string[] {
  const selected = normalizeSelection(selection);
  return chart.series.flatMap((series) => {
    const points = series.points.filter((point) => point.x >= selected.start && point.x <= selected.end);
    if (!points.length) return [];
    if (isSecondarySeries(series)) {
      const total = series.points.reduce((sum, point) => sum + point.y, 0);
      const amount = points.reduce((sum, point) => sum + point.y, 0);
      if (series.label === 'Earned exposure') {
        const share = total > 0 ? (100 * amount) / total : 0;
        return [`Earned exposure ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} · ${share.toFixed(1)}% of book`];
      }
      return [`${series.label} ${amount.toFixed(1)}%`];
    }
    const first = points[0].y;
    const last = points[points.length - 1].y;
    const fmt = (value: number) =>
      Math.abs(value) >= 10 ? value.toFixed(1) : Math.abs(value) >= 1 ? value.toFixed(2) : value.toFixed(3);
    // a single pinned point with a standard error reads out its ±2 SE
    // interval beside the estimate, on the same scale as the series
    const se = points.length === 1 ? points[0].se : null;
    const interval =
      se != null
        ? ` (${fmt(first * Math.exp(-2 * se))} to ${fmt(first * Math.exp(2 * se))})`
        : '';
    return [
      `${series.label} ${points.length === 1 ? `${fmt(first)}${interval}` : `${fmt(first)} → ${fmt(last)}`}`,
    ];
  });
}

export function weakPoint(chart: EvidenceChart, contract: ChartContract): string {
  if (chart.kind === 'territory') return chart.notes.find((note) => note.includes('5%')) ?? chart.notes[0];
  if (chart.kind === 'folds') return chart.notes[0];
  if (chart.kind === 'lift') {
    const actual = chart.series.find((series) => series.label === 'Actual, this model');
    const predicted = chart.series.find((series) => series.label === 'Predicted');
    if (actual && predicted) {
      const gaps = actual.points.flatMap((point) => {
        const expected = predicted.points.find((item) => Math.abs(item.x - point.x) < 1e-9);
        return expected ? [{ point, gap: Math.abs(point.y - expected.y) }] : [];
      });
      if (gaps.length) {
        const largest = gaps.reduce((max, item) => (item.gap > max.gap ? item : max));
        return `Largest calibration gap: decile ${largest.point.label ?? largest.point.x} · ${largest.gap.toFixed(3)} claims per car-year`;
      }
    }
  }
  const weight = chart.series.find(isSecondarySeries);
  if (weight?.points.length) {
    const thinnest = weight.points.reduce((min, point) => (point.y < min.y ? point : min));
    const label =
      chart.series.flatMap((series) => series.points).find((point) => point.x === thinnest.x)?.label ??
      thinnest.x;
    // where the thin slice's estimate carries a standard error, the weak
    // point names the band there: thin exposure and wide uncertainty are the
    // same fact seen from two sides
    const banded = chart.series
      .filter((series) => !isSecondarySeries(series))
      .flatMap((series) => series.points)
      .find((point) => point.x === thinnest.x && point.se != null);
    const bandNote = banded
      ? ` · ±2 SE ${(banded.y * Math.exp(-2 * banded.se!)).toFixed(2)} to ${(banded.y * Math.exp(2 * banded.se!)).toFixed(2)} there`
      : '';
    if (weight.label === 'Earned exposure') {
      const dimension = chart.xLabel.toLowerCase().includes('age') ? 'age ' : '';
      return `Thinnest evidence: ${dimension}${label} · ${thinnest.y.toLocaleString('en-US', { maximumFractionDigits: 0 })} earned car-years${bandNote}`;
    }
    return `Thinnest evidence: ${label} · ${thinnest.y.toFixed(1)}% of exposure${bandNote}`;
  }
  return chart.notes[1] ?? chart.notes[0] ?? `${contract.question} Exact evidence available.`;
}

/**
 * The x the weak-point sentence talks about, as a pinnable selection. Charts
 * whose weakness is not tied to one x (territory, folds) return null and the
 * empty slot keeps its plain instructions.
 */
export function weakestSelection(chart: EvidenceChart): ChartSelection | null {
  if (chart.kind === 'lift') {
    const actual = chart.series.find((series) => series.label === 'Actual, this model');
    const predicted = chart.series.find((series) => series.label === 'Predicted');
    if (actual && predicted) {
      const gaps = actual.points.flatMap((point) => {
        const expected = predicted.points.find((item) => Math.abs(item.x - point.x) < 1e-9);
        return expected ? [{ x: point.x, gap: Math.abs(point.y - expected.y) }] : [];
      });
      if (gaps.length) {
        const largest = gaps.reduce((max, item) => (item.gap > max.gap ? item : max));
        return { start: largest.x, end: largest.x };
      }
    }
    return null;
  }
  if (chart.kind === 'territory' || chart.kind === 'folds') return null;
  if (chart.kind === 'missingness') {
    // The chart's own question is "where is mileage missing most": the pin
    // answers it with the worst region
    const share = chart.series.find((series) => !isSecondarySeries(series));
    if (!share?.points.length) return null;
    const worst = share.points.reduce((max, point) => (point.y > max.y ? point : max));
    return { start: worst.x, end: worst.x };
  }
  if (chart.kind === 'segment_effects') {
    // No exposure series here; the scrutiny point is the factor pulling the
    // segment furthest from the book average, the same one the weakness
    // sentence names
    const effect = chart.series.find((series) => !isSecondarySeries(series));
    if (!effect?.points.length) return null;
    const largest = effect.points.reduce((max, point) =>
      Math.abs(point.y - 1) > Math.abs(max.y - 1) ? point : max,
    );
    return { start: largest.x, end: largest.x };
  }
  const weight = chart.series.find(isSecondarySeries);
  if (weight?.points.length) {
    const thinnest = weight.points.reduce((min, point) => (point.y < min.y ? point : min));
    return { start: thinnest.x, end: thinnest.x };
  }
  return null;
}

/** What pressing the weak-slice button pins, in the chart's own words */
export function weakActionLabel(chart: EvidenceChart): string {
  if (chart.kind === 'lift') return 'Pin largest gap';
  if (chart.kind === 'segment_effects') return 'Pin largest contribution';
  if (chart.kind === 'missingness') return 'Pin worst region';
  return 'Pin weakest slice';
}

export function parseSelection(value: string | null): ChartSelection | null {
  if (!value) return null;
  const [rawStart, rawEnd = rawStart] = value.split(':');
  const start = Number(rawStart);
  const end = Number(rawEnd);
  return Number.isFinite(start) && Number.isFinite(end) ? normalizeSelection({ start, end }) : null;
}

export function selectionForChart(
  chart: EvidenceChart,
  selection: ChartSelection | null,
  allowRange: boolean,
): ChartSelection | null {
  if (!selection) return null;
  const xs = Array.from(
    new Set(chart.series.flatMap((series) => series.points.map((point) => point.x))),
  ).sort((a, b) => a - b);
  if (!xs.length) return null;
  const normalized = normalizeSelection(selection);
  if (normalized.start < xs[0] || normalized.end > xs[xs.length - 1]) return null;
  const nearest = (value: number) =>
    xs.reduce((best, x) => (Math.abs(x - value) < Math.abs(best - value) ? x : best));
  const start = nearest(normalized.start);
  return normalizeSelection({ start, end: allowRange ? nearest(normalized.end) : start });
}

export const serializeSelection = (selection: ChartSelection) => {
  const normalized = normalizeSelection(selection);
  return `${normalized.start}:${normalized.end}`;
};

/** Where the studio seats the value table. `off` is the plot alone. */
export type TablePlace = 'side' | 'below' | 'only' | 'off';
export const TABLE_PLACES: TablePlace[] = ['side', 'below', 'only', 'off'];
export const isTablePlace = (value: string | null): value is TablePlace =>
  !!value && (TABLE_PLACES as string[]).includes(value);

/** The identity half of a workspace context: what a number has to travel
 *  with to stay evidence. Surfaces without ask and save paths still have it. */
export type ChartIdentity = Pick<
  ChartWorkspaceContext,
  'runId' | 'code' | 'target' | 'denominator' | 'baseVersion'
>;

/** The provenance line leading a copied block or an exported file: numbers
 *  travel with what produced them, or they are not evidence. */
export function chartSourceLine(
  chart: EvidenceChart,
  context?: ChartIdentity,
  askSource?: string,
  mode?: ChartMode,
): string {
  // the change view's numbers are differences, and a pasted block that does
  // not say so reads as levels
  const view = mode === 'change' ? ' · change view' : '';
  if (context) {
    return `${chart.title}${view} · ${context.code} · run ${context.runId} · on v${context.baseVersion} · ${context.target} / ${context.denominator}`;
  }
  return askSource ? `${chart.title}${view} · ${askSource}` : `${chart.title}${view}`;
}

/** File stem for an exported table: identity first, so a folder of exports
 *  sorts by experiment and stays attributable to a run and a version. */
export function chartFileBase(
  chart: EvidenceChart,
  context?: ChartIdentity,
  mode?: ChartMode,
): string {
  const slug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const view = mode === 'change' ? '-change' : '';
  return context
    ? `${slug(context.code)}-${slug(chart.kind)}${view}-run-${slug(context.runId)}-v${context.baseVersion}`
    : `${slug(chart.title) || 'chart-values'}${view}`;
}

export function updateEvidenceUrl(updates: {
  exp?: string | null;
  chart?: string | null;
  mode?: ChartMode | null;
  selection?: ChartSelection | null;
  full?: boolean | null;
  table?: TablePlace | null;
}) {
  const url = new URL(location.href);
  const set = (key: string, value?: string | null) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  };
  if ('exp' in updates) set('exp', updates.exp);
  if ('chart' in updates) set('chart', updates.chart);
  // null means "the chart's own default": the URL only records departures
  if ('mode' in updates) set('mode', updates.mode ?? null);
  if ('selection' in updates) {
    set('sel', updates.selection ? serializeSelection(updates.selection) : null);
  }
  if ('full' in updates) set('full', updates.full ? '1' : null);
  // the placement rides the evidence link, so a shared reading opens on the
  // surface its author was reading it on
  if ('table' in updates) set('tbl', updates.table ?? null);
  history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}

export function buildAgentQuestion(
  chart: EvidenceChart,
  context: ChartWorkspaceContext,
  selection: ChartSelection,
  mode: ChartMode,
): string {
  return `Explain ${selectionLabel(chart, selection)} in ${context.code}'s ${chart.title}. Use ${mode === 'change' ? 'the change comparison' : 'the level view'}, ${context.target} per ${context.denominator}, model ${context.model}, run ${context.runId}, and this chart's exact values and exposure. Call out weak evidence and what should be checked next.`;
}

export function buildAgentAsk(
  chart: EvidenceChart,
  context: ChartWorkspaceContext,
  selection: ChartSelection,
  mode: ChartMode,
): AgentAsk {
  return {
    question: `Explain ${selectionLabel(chart, selection)} in ${chart.title.toLowerCase()}. What is weak here and what should be checked next?`,
    context: [
      context.code,
      chart.title,
      selectionLabel(chart, selection),
      mode === 'change' ? 'change view' : 'level view',
      `${context.target} / ${context.denominator}`,
      `run ${context.runId}`,
    ].join(' · '),
    send: buildAgentQuestion(chart, context, selection, mode),
  };
}

/**
 * The same carried ask for a chart with no workspace context — the mini
 * charts an answer draws. Provenance is whatever the answer cited.
 */
export function buildChartAsk(
  chart: EvidenceChart,
  selection: ChartSelection,
  mode: ChartMode,
  source?: string | null,
): AgentAsk {
  const label = selectionLabel(chart, selection);
  const question = `Explain ${label} in ${chart.title.toLowerCase()}. What is weak here and what should be checked next?`;
  const context = [
    source,
    chart.title,
    label,
    mode === 'change' ? 'change view' : 'level view',
  ]
    .filter(Boolean)
    .join(' · ');
  return { question, context, send: `${question} Context: ${context}.` };
}

/**
 * One reading of one chart: run, experiment, chart, slice, and view. Saving
 * the same reading twice is the same card, which is what lets the workspace
 * say a reading is already carried into review.
 */
export function savedEvidenceId(
  chart: EvidenceChart,
  context: ChartWorkspaceContext,
  selection: ChartSelection,
  mode: ChartMode,
): string {
  return `${context.runId}:${context.code}:${chart.kind}:${serializeSelection(selection)}:${mode}`;
}

export function makeSavedEvidence(
  chart: EvidenceChart,
  context: ChartWorkspaceContext,
  selection: ChartSelection,
  mode: ChartMode,
): SavedChartEvidence {
  const contract = contractFor(chart);
  const shown = displayChart(chart, contract, mode);
  return {
    id: savedEvidenceId(chart, context, selection, mode),
    runId: context.runId,
    baseVersion: context.baseVersion,
    code: context.code,
    chartKind: chart.kind,
    title: chart.title,
    question: contract.question,
    selection: selectionLabel(chart, selection),
    mode,
    values: selectionValues(shown, selection),
    weakPoint: weakPoint(chart, contract),
    source: `${context.code} · run ${context.runId} · on v${context.baseVersion} · ${context.target} / ${context.denominator}`,
    url: location.href,
    savedAt: new Date().toISOString(),
  };
}
