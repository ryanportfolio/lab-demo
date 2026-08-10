// The studio's chart navigator: every chart the run produced, grouped by
// experiment with its verdict, searchable, pinnable, density set by the user —
// the harness-sidebar shape, purpose-built for run evidence. All UI state
// (density, collapse, pins, folded groups) is saved on this browser.

import { useEffect, useRef, useState } from 'react';
import { fetchEvidence, type Experiment, type EvidenceChart } from './api';
import { contractFor } from './chartWorkspace';
import { chartsFromEvidence } from './evidenceCharts';

type Density = 'compact' | 'info' | 'rich';
const DENSITIES: Density[] = ['compact', 'info', 'rich'];

interface NavPrefs {
  density: Density;
  collapsed: boolean;
  pins: string[];
  closed: string[];
}

const KEY = 'plab-studio-nav';
// Below this viewport width the navigator would squeeze the chart too hard,
// so it starts as the slim strip (still expandable by hand)
const ROOMY_VIEWPORT = 1370;

function loadPrefs(): Partial<NavPrefs> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const pinKey = (code: string, kind: string) => `${code}:${kind}`;

export default function StudioNav({
  runId,
  experiments,
  activeCode,
  activeKind,
  onNavigate,
}: {
  runId: string;
  experiments: Experiment[];
  activeCode: string;
  activeKind: string | null;
  onNavigate: (code: string, kind: string) => void;
}) {
  const prefs = useRef(loadPrefs());
  const [density, setDensity] = useState<Density>(() =>
    DENSITIES.includes(prefs.current.density as Density)
      ? (prefs.current.density as Density)
      : 'compact',
  );
  const [collapsed, setCollapsed] = useState<boolean>(
    () => prefs.current.collapsed ?? window.innerWidth < ROOMY_VIEWPORT,
  );
  const [pins, setPins] = useState<string[]>(() =>
    Array.isArray(prefs.current.pins) ? prefs.current.pins.filter((p) => typeof p === 'string') : [],
  );
  const [closed, setClosed] = useState<string[]>(() =>
    Array.isArray(prefs.current.closed)
      ? prefs.current.closed.filter((c) => typeof c === 'string')
      : [],
  );
  const [filter, setFilter] = useState('');
  const [charts, setCharts] = useState<Record<string, EvidenceChart[]> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ density, collapsed, pins, closed }));
    } catch {
      /* private mode: preferences simply stop persisting */
    }
  }, [density, collapsed, pins, closed]);

  useEffect(() => {
    let live = true;
    const landed = experiments.filter((experiment) => experiment.status !== 'running');
    Promise.all(
      landed.map(async (experiment) => {
        try {
          const evidence = await fetchEvidence(runId, experiment.code);
          return [experiment.code, evidence ? chartsFromEvidence(evidence) : []] as const;
        } catch {
          return [experiment.code, []] as const;
        }
      }),
    ).then((entries) => {
      if (live) setCharts(Object.fromEntries(entries));
    });
    return () => {
      live = false;
    };
  }, [runId, experiments]);

  const needle = filter.trim().toLowerCase();
  const matches = (experiment: Experiment, chart: EvidenceChart) =>
    !needle ||
    `${experiment.code} ${experiment.name} ${chart.title} ${contractFor(chart).question}`
      .toLowerCase()
      .includes(needle);

  const verdict = (experiment: Experiment) =>
    experiment.status === 'winner' ? 'win' : experiment.status === 'scrapped' ? 'scr' : 'abs';

  const row = (experiment: Experiment, chart: EvidenceChart) => {
    const key = pinKey(experiment.code, chart.kind);
    const active = experiment.code === activeCode && chart.kind === activeKind;
    const pinned = pins.includes(key);
    return (
      <div className="snav-item" key={key} data-active={active || undefined}>
        <button
          type="button"
          className="snav-open"
          aria-current={active || undefined}
          onClick={() => onNavigate(experiment.code, chart.kind)}
        >
          <span className="snav-bullet" aria-hidden="true" />
          <span className="snav-t">
            <b>{chart.title}</b>
            <small>
              <b>{experiment.code}</b> · run {runId} · BI claims / earned car year
            </small>
            <span className="snav-q">{contractFor(chart).question}</span>
          </span>
        </button>
        <button
          type="button"
          className="snav-star"
          data-on={pinned || undefined}
          aria-pressed={pinned}
          aria-label={`${pinned ? 'Unpin' : 'Pin'} ${chart.title}`}
          onClick={() =>
            setPins((prev) => (pinned ? prev.filter((p) => p !== key) : [...prev, key]))
          }
        >
          ★
        </button>
      </div>
    );
  };

  const pinnedRows = charts
    ? experiments.flatMap((experiment) =>
        (charts[experiment.code] ?? [])
          .filter(
            (chart) =>
              pins.includes(pinKey(experiment.code, chart.kind)) && matches(experiment, chart),
          )
          .map((chart) => row(experiment, chart)),
      )
    : [];

  const hasMatches =
    pinnedRows.length > 0 ||
    (!!charts &&
      experiments.some((experiment) =>
        (charts[experiment.code] ?? []).some((chart) => matches(experiment, chart)),
      ));

  return (
    <div className="snav" data-collapsed={collapsed || undefined} data-density={density}>
      <div className="snav-top">
        <button
          type="button"
          className="snav-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand the chart list' : 'Collapse the chart list'}
          onClick={() => setCollapsed((prev) => !prev)}
        >
          ⟨⟩
        </button>
        {!collapsed && (
          <>
            <label className="snav-search">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <circle cx="5" cy="5" r="3.6" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 8l2.6 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                value={filter}
                placeholder="Search charts"
                aria-label="Search charts in this run"
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="snav-density"
              title={`Row density: ${density} — click to change`}
              aria-label={`Row density: ${density}. Click to change`}
              onClick={() =>
                setDensity(
                  (prev) => DENSITIES[(DENSITIES.indexOf(prev) + 1) % DENSITIES.length],
                )
              }
            >
              Aa
            </button>
          </>
        )}
      </div>
      {!collapsed && (
        <>
          <div className="snav-list">
            {!charts && <div className="snav-empty">Reading run artifacts</div>}
            {pinnedRows.length > 0 && <div className="snav-label">Pinned</div>}
            {pinnedRows}
            {charts &&
              experiments
                .filter((experiment) => experiment.status !== 'running')
                .map((experiment) => {
                  const rows = (charts[experiment.code] ?? []).filter((chart) =>
                    matches(experiment, chart),
                  );
                  if (!rows.length && needle) return null;
                  const folded = closed.includes(experiment.code) && !needle;
                  return (
                    <div
                      className="snav-group"
                      key={experiment.code}
                      data-closed={folded || undefined}
                    >
                      <button
                        type="button"
                        className="snav-sect"
                        aria-expanded={!folded}
                        onClick={() =>
                          setClosed((prev) =>
                            prev.includes(experiment.code)
                              ? prev.filter((code) => code !== experiment.code)
                              : [...prev, experiment.code],
                          )
                        }
                      >
                        <span className="snav-dot" data-v={verdict(experiment)} aria-hidden="true" />
                        <span className="snav-st">
                          <b>{experiment.code}</b>
                          {experiment.name}
                        </span>
                        <span className="snav-chev" aria-hidden="true">▼</span>
                      </button>
                      {!folded &&
                        (rows.length ? (
                          rows.map((chart) => row(experiment, chart))
                        ) : (
                          <div className="snav-none">Stopped before it made a chart</div>
                        ))}
                    </div>
                  );
                })}
            {charts && needle && !hasMatches && (
              <div className="snav-empty">No charts match "{filter.trim()}"</div>
            )}
          </div>
          <div className="snav-foot">Pin ★ favorites · saved on this browser</div>
        </>
      )}
    </div>
  );
}
