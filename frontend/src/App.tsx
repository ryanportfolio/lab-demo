// The experiment workspace. Live backend state stays authoritative. The UI
// keeps model context fixed while one linked selection drives the frontier,
// run ledger, evidence, context expert, and human review.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveReview,
  fetchDatasetSummary,
  fetchLatestRun,
  fetchReview,
  fetchRun,
  startRun,
  type DatasetSummary,
  type Review,
  type Run,
} from './api';
import AgentActionLog from './AgentActionLog';
import AskPanel from './AskPanel';
import ContextStrip from './ContextStrip';
import EvidencePanel from './EvidencePanel';
import ExperimentLedger from './ExperimentLedger';
import Frontier from './Frontier';
import ReviewView from './ReviewView';
import RunHistory from './RunHistory';
import { fmtDelta, fmtGini } from './format';
import {
  updateEvidenceUrl,
  type AgentAsk,
  type SavedChartEvidence,
} from './chartWorkspace';

type ThemePref = 'light' | 'dark' | 'system';
type View = 'console' | 'review';

function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  root.dataset.themePref = pref;
  const resolved =
    pref === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : pref;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  try {
    localStorage.setItem('plab-demo-theme', pref);
  } catch {
    /* private mode */
  }
}

const nextTheme = (theme: ThemePref): ThemePref =>
  theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [run, setRun] = useState<Run | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [dataset, setDataset] = useState<DatasetSummary | null>(null);
  const [view, setViewState] = useState<View>(
    location.hash === '#review' || params.get('view') === 'review'
      ? 'review'
      : 'console',
  );
  const [themePref, setThemePref] = useState<ThemePref>(
    (document.documentElement.dataset.themePref as ThemePref) ?? 'system',
  );
  const [selectedCode, setSelectedCode] = useState<string | null>(params.get('exp'));
  const [error, setError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [announcement, setAnnouncement] = useState('');
  const [askOpen, setAskOpen] = useState(false);
  const [askSeed, setAskSeed] = useState<AgentAsk | null>(null);
  const [savedEvidence, setSavedEvidence] = useState<SavedChartEvidence[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('plab-saved-evidence') ?? '[]');
    } catch {
      return [];
    }
  });
  const landedSeen = useRef<Set<string>>(new Set());
  const starting = useRef(false);
  const userSelected = useRef(!!params.get('exp'));
  // A ?run= url pins the view to that run (e.g. inspecting a superseded
  // review); Replay clears the pin and returns to the live latest run
  const requestedRun = useRef<string | null>(params.get('run'));

  const running = run?.status === 'running';
  const complete = run?.status === 'complete';

  useEffect(() => {
    (async () => {
      try {
        const [latest, summary] = await Promise.all([
          requestedRun.current ? fetchRun(requestedRun.current) : fetchLatestRun(),
          fetchDatasetSummary(),
        ]);
        setDataset(summary);
        if (latest) {
          setRun(latest);
        } else if (requestedRun.current) {
          setError(`Run ${requestedRun.current} does not exist on this server.`);
        } else if (!starting.current) {
          starting.current = true;
          setRun(await startRun());
        }
      } catch (caught) {
        setError(String(caught));
      }
    })();
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(async () => {
      try {
        const latest = requestedRun.current
          ? await fetchRun(requestedRun.current)
          : await fetchLatestRun();
        if (latest) setRun(latest);
      } catch (caught) {
        setError(String(caught));
      }
    }, 400);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(interval);
  }, [running]);

  useEffect(() => {
    if (!run) return;
    // Never hold a review from a different run: a stale pair would render a
    // hybrid view and let an approval target the wrong review
    if (review && review.runId !== run.id) {
      setReview(null);
      return;
    }
    if (review?.runId === run.id) return;
    // The run row turns complete a beat before the agent's review row exists,
    // so a completed run without a review is retried, not treated as final
    if (!run.reviewId && run.status !== 'complete') return;
    let cancelled = false;
    const attempt = () =>
      fetchReview(run.id)
        .then((nextReview) => {
          if (!cancelled && nextReview && nextReview.runId === run.id) setReview(nextReview);
        })
        .catch((caught) => setError(String(caught)));
    attempt();
    const interval = setInterval(attempt, 700);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [run, review]);

  useEffect(() => {
    if (!run) return;
    const selected = run.experiments.find((experiment) => experiment.code === selectedCode);
    if (userSelected.current && selected && selected.status !== 'running') return;

    const landed = run.experiments.filter((experiment) => experiment.status !== 'running');
    const next =
      (run.winnerCode && landed.find((experiment) => experiment.code === run.winnerCode)) ||
      landed[landed.length - 1];
    if (next) setSelectedCode(next.code);
  }, [run, selectedCode]);

  useEffect(() => {
    if (!run) return;
    for (const experiment of run.experiments) {
      if (experiment.status !== 'running' && !landedSeen.current.has(experiment.code)) {
        landedSeen.current.add(experiment.code);
        if (experiment.verdictTag && experiment.verdictText) {
          setAnnouncement(
            `${experiment.code} ${experiment.verdictTag}: ${experiment.verdictText}`,
          );
        }
      }
    }
    if (complete && run.winnerCode) {
      setAnnouncement(`Run complete. ${run.winnerCode} is ready for review.`);
    }
  }, [run, complete]);

  useEffect(() => {
    applyTheme(themePref);
  }, [themePref]);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (document.documentElement.dataset.themePref === 'system') applyTheme('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setView = useCallback((nextView: View) => {
    setViewState(nextView);
    if (nextView === 'review' && location.hash !== '#review') location.hash = 'review';
    if (nextView === 'console') {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, 0);
    setAnnouncement(nextView === 'review' ? 'Model review opened.' : 'Back to the run.');
  }, []);

  useEffect(() => {
    const onHash = () => setViewState(location.hash === '#review' ? 'review' : 'console');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (document.body.classList.contains('chartfull')) return;
        event.preventDefault();
        setAskOpen((open) => {
          if (!open) setAskSeed(null);
          return !open;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('plab-saved-evidence', JSON.stringify(savedEvidence));
    } catch {
      /* local prototype storage can be unavailable in private mode */
    }
  }, [savedEvidence]);

  const askFromEvidence = useCallback((ask: AgentAsk) => {
    setAskSeed(ask);
    setAskOpen(true);
  }, []);

  const saveEvidence = useCallback((evidence: SavedChartEvidence) => {
    setSavedEvidence((current) => [
      evidence,
      ...current.filter((item) => item.id !== evidence.id),
    ].slice(0, 8));
    setAnnouncement(`${evidence.title}, ${evidence.selection}, saved to human review.`);
  }, []);

  const chooseExperiment = useCallback((code: string) => {
    userSelected.current = true;
    setSelectedCode(code);
    updateEvidenceUrl({ exp: code, chart: null, mode: null, selection: null });
    setAnnouncement(`${code} evidence selected.`);
  }, []);

  const revealExperiment = useCallback((code: string) => {
    setViewState('console');
    userSelected.current = true;
    setSelectedCode(code);
    updateEvidenceUrl({ exp: code, chart: null, mode: null, selection: null });
    requestAnimationFrame(() => {
      document.getElementById('selected-evidence')?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });
  }, []);

  const replay = useCallback(async () => {
    try {
      setReview(null);
      setSelectedCode(null);
      userSelected.current = false;
      landedSeen.current.clear();
      requestedRun.current = null;
      setViewState('console');
      updateEvidenceUrl({ exp: null, chart: null, mode: null, selection: null });
      setRun(await startRun());
    } catch (caught) {
      setError(String(caught));
    }
  }, []);

  const onApprove = useCallback(async () => {
    if (!review || !run || review.runId !== run.id) return;
    setApproving(true);
    setApproveError(null);
    try {
      await approveReview(review.id);
      const nextReview = await fetchReview(run.id);
      if (nextReview) setReview(nextReview);
      // The approval appended the run's one human action; refresh the record
      const refreshed = await fetchRun(run.id);
      if (refreshed) setRun(refreshed);
      setAnnouncement('Approved. New version created with the run ledger attached.');
      requestAnimationFrame(() => document.getElementById('rvStamp')?.focus());
    } catch (caught) {
      setApproveError(String(caught));
    } finally {
      setApproving(false);
    }
  }, [review, run]);

  const experiments = run?.experiments ?? [];
  const landedCount = experiments.filter((experiment) => experiment.status !== 'running').length;
  const candidateCount = experiments.filter((experiment) =>
    ['candidate', 'absorbed'].includes(experiment.status),
  ).length;
  const scrappedCount = experiments.filter((experiment) => experiment.status === 'scrapped').length;
  const elapsedText = run
    ? running
      ? `${Math.max(0, (nowMs - run.startedAtMs) / 1000).toFixed(1)}s`
      : run.elapsedMs != null
        ? `${(run.elapsedMs / 1000).toFixed(1)}s`
        : '0.0s'
    : '0.0s';
  const selected = experiments.find((experiment) => experiment.code === selectedCode) ?? null;
  const winner = run?.winnerCode
    ? experiments.find((experiment) => experiment.code === run.winnerCode)
    : null;

  return (
    <>
      <a className="skip-link" href="#workspace-main">Skip to model workspace</a>
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true" />
          <span>Prediction Lab</span>
          <small>Product concept</small>
        </div>
        <nav className="crumb" aria-label="Breadcrumb">
          Models<span>›</span>Bodily Injury Frequency<span>›</span>
          <RunHistory
            label={
              view === 'review'
                ? `Review${review ? ` v${review.nextVersion}` : ''}`
                : run
                  ? `Run ${run.id}`
                  : 'Run pending'
            }
            currentId={run?.id ?? null}
          />
        </nav>
        <div className="tb-right">
          <span className="branch-readout">{run?.branchName ?? 'run pending'}</span>
          <button
            className="theme-cycle"
            type="button"
            onClick={() => setThemePref((theme) => nextTheme(theme))}
          >
            Theme · {themePref}
          </button>
          <button
            className="askbtn"
            onClick={() => {
              setAskSeed(null);
              setAskOpen(true);
            }}
            disabled={!run || !complete}
            title={complete ? 'Ask from this run\'s artifacts' : 'Available when the run finishes'}
          >
            Ask AI <span className="kbd" aria-hidden="true">⌘K</span>
          </button>
        </div>
      </header>

      <ContextStrip dataset={dataset} run={run} view={view} />

      {error && (
        <div className="banner" role="alert">
          {error.includes('fetch')
            ? 'The API is unreachable. Start the backend, then reload.'
            : error}
        </div>
      )}

      {view === 'console' ? (
        <main className="run-view" id="workspace-main">
          <section className="goal-bar" aria-label="Agent goal and run status">
            <div className="goal-copy">
              <span className="ai-mark" aria-hidden="true">AI</span>
              <div>
                <span className="eyebrow">Agent goal</span>
                <strong>{run?.goal ?? 'Loading the modeling run'}</strong>
              </div>
            </div>
            {complete && winner && run && (
              <section className="promote" aria-label="Winner ready for review">
                <div>
                  <span className="winner-mark" aria-hidden="true" />
                  <strong>{winner.code} ready for human review</strong>
                  <span>
                    Gini {fmtGini(winner.gini ?? 0)} · {fmtDelta(winner.deltaGini ?? 0)} · {scrappedCount} failures retained
                  </span>
                </div>
                <button type="button" onClick={() => setView('review')}>Open decision package →</button>
              </section>
            )}
            <div className="goal-rails" aria-label="Hard guardrails">
              {(run?.rails ?? []).map((rail) => (
                <span key={rail.key} data-state={rail.mark} title={rail.note ?? rail.label}>
                  <i aria-hidden="true">{rail.mark === 'enforced' ? '!' : rail.mark === 'passed' ? '✓' : '·'}</i>
                  {rail.label
                    .replace('At most ', '≤')
                    .replace(' new rating factors', ' factors')
                    .replace('Territory rate movement within ', 'territory ')
                    .replace('Lift must hold across ', '')}
                </span>
              ))}
            </div>
            <div className="run-state">
              <strong>{landedCount} / 7</strong>
              <span>{running ? 'running' : complete ? 'complete' : 'loading'} · {elapsedText}</span>
              <button className="replay" type="button" onClick={replay} disabled={running}>
                Replay
              </button>
            </div>
          </section>

          <div className="run-workspace">
            <ExperimentLedger
              experiments={experiments}
              selectedCode={selectedCode}
              onSelect={chooseExperiment}
            />

            <section className="frontier-panel" aria-labelledby="frontier-heading">
              <header className="workspace-heading">
                <div>
                  <span className="eyebrow">Question cost</span>
                  <h2 id="frontier-heading">Experiment frontier</h2>
                </div>
                <span className="section-count">{candidateCount} forward · {scrappedCount} stopped</span>
              </header>
              <Frontier
                experiments={experiments}
                baselineGini={run?.baselineGini ?? null}
                complete={!!complete}
                winnerCode={run?.winnerCode ?? null}
                hovered={null}
                selectedCode={selectedCode}
                onSelect={chooseExperiment}
              />
              <div className="frontier-readout">
                <span>Higher is better</span>
                <span>Right spends factor budget</span>
                <strong>{winner?.deltaGini != null ? `${fmtDelta(winner.deltaGini)} winner` : 'Waiting for winner'}</strong>
              </div>
            </section>

            <section className="selected-evidence" id="selected-evidence" aria-label="Selected experiment evidence">
              {run && selected && selected.status !== 'running' ? (
                <EvidencePanel
                  runId={run.id}
                  code={selected.code}
                  plain={false}
                  experiment={selected}
                  focused
                  onAsk={askFromEvidence}
                  onSave={saveEvidence}
                  baseVersion={run.baseModelVersion}
                />
              ) : (
                <div className="evidence-empty" aria-busy={running}>
                  <span className="eyebrow">Evidence</span>
                  <h2>{running ? 'Waiting for the first fit' : 'Select an experiment'}</h2>
                </div>
              )}
            </section>
          </div>

          <AgentActionLog actions={run?.actions ?? []} onSelectExperiment={chooseExperiment} />

        </main>
      ) : run && review && review.runId === run.id ? (
        <ReviewView
          run={run}
          review={review}
          plain={false}
          onBack={() => setView('console')}
          onApprove={onApprove}
          approving={approving}
          error={approveError}
          savedEvidence={savedEvidence}
          onAsk={askFromEvidence}
          onSave={saveEvidence}
        />
      ) : (
        <main className="review-loading" id="workspace-main">
          <button className="back" type="button" onClick={() => setView('console')}>← Back to run</button>
          <p>{running ? 'The run is still working' : 'No review is open for this run'}</p>
        </main>
      )}

      <div className="sr" aria-live="polite">{announcement}</div>

      <AskPanel
        runId={run?.id ?? null}
        ready={!!complete}
        plain={false}
        open={askOpen}
        onClose={() => setAskOpen(false)}
        onCite={revealExperiment}
        seed={askSeed}
      />
    </>
  );
}
