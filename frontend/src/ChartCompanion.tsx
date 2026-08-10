// The companion strip: everything that would invalidate a reading of the
// chart if it were different, visible at the moment of interpretation. A
// screenshot of the chart now carries its data window, version, denominator,
// and population instead of leaving the reader to reconstruct them. It is a
// view over facts the surface already has; nothing here is fetched or
// hardcoded, and a fact the surface lacks simply does not render.

import type { EvidenceChart } from './api';
import type { ChartMode, ChartWorkspaceContext } from './chartWorkspace';

const carYears = (value: number) =>
  `${value.toLocaleString('en-US', { maximumFractionDigits: 0 })} earned car years`;

export default function ChartCompanion({
  chart,
  context,
  mode,
  bandsShown,
  full,
  askSource,
}: {
  chart: EvidenceChart;
  /** workspace surfaces carry full provenance; answer mini charts do not */
  context?: ChartWorkspaceContext;
  mode: ChartMode;
  /** ±2 SE bands are visible, so the method line is owed */
  bandsShown: boolean;
  /** the studio full view shows every row; the card shows one condensed line */
  full: boolean;
  /** loose source label for charts outside the workspace (answer charts) */
  askSource?: string;
}) {
  // the source line every chart surface already had, kept as the first row
  const sourceLine = context
    ? `${context.code} · run ${context.runId} · ${context.target} / ${context.denominator}`
    : askSource
      ? `${askSource} · ${chart.xLabel} / ${chart.yLabel}`
      : `${chart.xLabel} / ${chart.yLabel}`;

  const p = context?.provenance;
  const versionLine = context
    ? `v${context.baseVersion} → candidate, on the run branch`
    : null;
  const windowLine =
    p?.trainWindow || p?.holdoutWindow
      ? [
          p.trainWindow ? `train ${p.trainWindow}` : null,
          p.holdoutWindow ? `holdout ${p.holdoutWindow}, out of time` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;
  const populationLine =
    p?.trainRows != null && p?.trainExposure != null
      ? `${p.trainRows.toLocaleString('en-US')} policies · ${carYears(p.trainExposure)}${
          p.trainClaims != null
            ? ` · ${p.trainClaims.toLocaleString('en-US', { maximumFractionDigits: 0 })} claims`
            : ''
        }`
      : null;
  const foldLine =
    chart.kind === 'folds' && p?.foldValExposure != null
      ? `each fold validates on ~${carYears(p.foldValExposure)}`
      : null;
  // the method line is owed exactly while bands are on screen; a ridged
  // covariance is disclosed rather than silently narrowed
  const ciLine = bandsShown
    ? `bands: Wald ±2 SE from the final fit weights, log scale · level view only${
        p?.covRidge && p.covRidge > 0
          ? ` · ridged normal equations, bands biased narrow`
          : ''
      }`
    : null;

  if (!full) {
    // the card's condensed form: source plus the two context facts a
    // screenshot most needs, one line, mono label layer
    const condensed = [versionLine, windowLine].filter(Boolean).join(' · ');
    return (
      <div className="chart-source chart-companion" data-variant="card">
        <span>{sourceLine}</span>
        {condensed && <span>{condensed}</span>}
        {ciLine && <span>{ciLine}</span>}
      </div>
    );
  }

  const rows: Array<[string, string]> = [];
  if (versionLine) rows.push(['Model', versionLine]);
  if (windowLine) rows.push(['Window', windowLine]);
  if (populationLine) rows.push(['Population', populationLine]);
  if (foldLine) rows.push(['Folds', foldLine]);
  if (ciLine) rows.push(['Uncertainty', ciLine]);
  if (mode === 'change') rows.push(['View', 'change vs baseline, scales locked to the level frame']);

  return (
    <div className="chart-companion" data-variant="full">
      <div className="chart-source">{sourceLine}</div>
      {rows.length > 0 && (
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
