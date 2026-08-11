// The workspace focus: a reader's slice of the observed portfolio, held as a
// list of explicit constraints. Selection (highlight) and focus (filter) are
// deliberately different acts — a click never filters; promoting a pinned
// selection to a constraint is its own visible button, and every constraint
// stays on screen as a removable chip. The whole focus rides the URL, so a
// reload or a shared link reopens the same slice.

import type { EvidenceChart } from './api';
import type { ChartSelection } from './chartWorkspace';
import { normalizeSelection } from './chartWorkspace';

export type FocusField = 'driver_age' | 'prior_accidents' | 'territory' | 'region';

export interface FocusConstraint {
  field: FocusField;
  /** numeric bounds, inclusive; `hi` absent means "and above" (the 5+ cap) */
  lo?: number;
  hi?: number;
  /** categorical members (territory codes, region names) */
  values?: string[];
  /** the chip's text, derived once from the source chart's own labels */
  label: string;
}

/** The wire shape `portfolioSlice` and `sliceRecords` take. */
export interface SliceFilterInput {
  field: string;
  values?: string[];
  lo?: number;
  hi?: number;
}

export const toFilters = (focus: FocusConstraint[]): SliceFilterInput[] =>
  focus.map(({ field, lo, hi, values }) => ({ field, lo, hi, values }));

const FIELD_NOUN: Record<FocusField, string> = {
  driver_age: 'driver age',
  prior_accidents: 'prior accidents',
  territory: 'territory',
  region: 'region',
};

/** Which portfolio column a chart's x axis walks, if any. Charts without a
 *  real column underneath (lift deciles, folds, distributions) return null
 *  and never grow a focus button — drill-down needs a real hierarchy. */
function fieldForChart(chart: EvidenceChart): FocusField | null {
  switch (chart.kind) {
    case 'age_curve':
    case 'slice_age':
      return 'driver_age';
    case 'accidents':
    case 'slice_accidents':
      return 'prior_accidents';
    case 'territory':
    case 'slice_territory':
      return 'territory';
    case 'missingness':
    case 'missing_frequency':
    case 'slice_region':
      return 'region';
    default:
      return null;
  }
}

/** x → tick label, from whichever series carries labels. */
function labelsByX(chart: EvidenceChart): Map<number, string> {
  const map = new Map<number, string>();
  chart.series.forEach((series) =>
    series.points.forEach((point) => {
      if (point.label != null && !map.has(point.x)) map.set(point.x, point.label);
    }),
  );
  return map;
}

/**
 * Translate a pinned selection on a chart into a portfolio constraint.
 * Numeric axes become a range; categorical axes collect the selected tick
 * labels, because their x is a display rank, not a data value. A labelled
 * "5+" tick becomes an open-topped range.
 */
export function constraintFromSelection(
  chart: EvidenceChart,
  selection: ChartSelection,
): FocusConstraint | null {
  const field = fieldForChart(chart);
  if (!field) return null;
  const { start, end } = normalizeSelection(selection);
  const noun = FIELD_NOUN[field];

  if (field === 'driver_age') {
    return {
      field,
      lo: start,
      hi: end,
      label: start === end ? `${noun} ${start}` : `${noun} ${start}–${end}`,
    };
  }
  if (field === 'prior_accidents') {
    const labels = labelsByX(chart);
    const open = (labels.get(end) ?? '').endsWith('+');
    return {
      field,
      lo: start,
      hi: open ? undefined : end,
      label: open
        ? `${noun} ${start}+`
        : start === end
          ? `${noun} ${start}`
          : `${noun} ${start}–${end}`,
    };
  }
  const labels = labelsByX(chart);
  const values: string[] = [];
  for (const [x, label] of labels) {
    if (x >= start && x <= end && !values.includes(label)) values.push(label);
  }
  if (!values.length) return null;
  const label =
    values.length === 1
      ? `${noun} ${values[0]}`
      : `${values.length} ${noun === 'territory' ? 'territories' : `${noun}s`}`;
  return { field, values, label };
}

/** Add a constraint: one per field, newest wins, so re-focusing the same
 *  variable replaces instead of silently intersecting to nothing. */
export function addConstraint(
  focus: FocusConstraint[],
  next: FocusConstraint,
): FocusConstraint[] {
  return [...focus.filter((item) => item.field !== next.field), next];
}

// ---- URL round trip -------------------------------------------------------
// focus=driver_age:18-24|prior_accidents:3-|territory:T-104,T-105
// numeric  field:lo-hi   (hi empty = open top)
// category field:v1,v2   (values hold no commas or pipes by construction)

export function serializeFocus(focus: FocusConstraint[]): string {
  return focus
    .map((item) =>
      item.values
        ? `${item.field}:${item.values.join(',')}`
        : `${item.field}:${item.lo ?? ''}-${item.hi ?? ''}`,
    )
    .join('|');
}

export function parseFocus(raw: string | null): FocusConstraint[] {
  if (!raw) return [];
  const out: FocusConstraint[] = [];
  for (const part of raw.split('|')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const field = part.slice(0, colon) as FocusField;
    if (!(field in FIELD_NOUN)) continue;
    const rest = part.slice(colon + 1);
    const noun = FIELD_NOUN[field];
    if (field === 'territory' || field === 'region') {
      const values = rest.split(',').filter(Boolean);
      if (!values.length) continue;
      out.push({
        field,
        values,
        label:
          values.length === 1
            ? `${noun} ${values[0]}`
            : `${values.length} ${noun === 'territory' ? 'territories' : `${noun}s`}`,
      });
    } else {
      const [rawLo, rawHi = ''] = rest.split('-');
      const lo = rawLo === '' ? undefined : Number(rawLo);
      const hi = rawHi === '' ? undefined : Number(rawHi);
      if (lo == null && hi == null) continue;
      if ((lo != null && !Number.isFinite(lo)) || (hi != null && !Number.isFinite(hi))) continue;
      const label =
        hi == null
          ? `${noun} ${lo}+`
          : lo === hi
            ? `${noun} ${lo}`
            : `${noun} ${lo}–${hi}`;
      out.push({ field, lo, hi, label });
    }
  }
  return out;
}

export function updateFocusUrl(focus: FocusConstraint[]) {
  const url = new URL(location.href);
  if (focus.length) url.searchParams.set('focus', serializeFocus(focus));
  else url.searchParams.delete('focus');
  history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
}
