// The Experiments console: live run view + review handoff, backed by the
// GraphQL API. Two-layer copy everywhere: dense expert chips and verdicts,
// plus Plain terms gloss lines under every result.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveReview,
  fetchLatestRun,
  fetchReview,
  startRun,
  type Experiment,
  type Review,
  type Run,
} from './api';
import Frontier from './Frontier';
import ReviewView from './ReviewView';
import { countWord, fmtAic, fmtDelta, fmtDev, fmtGini, fmtThousands } from './format';

type ThemePref = 'light' | 'dark' | 'system';
type View = 'console' | 'review';

const GOAL_GLOSS =
  'Frequency is how often a driver’s actions lead to bodily injury claims against the policy, and this model predicts that rate per insured car year. Every input it prices on is a rating factor. Territory relativities are the zone by zone price multipliers, filed with the regulator, which is why they may not drift.';
const GRID_GLOSS =
  'ΔGini is separation power, how much better the model splits high risk drivers from low risk, higher is better. Deviance is the model’s error score, and the chip shows how much it changed, so a minus number means the error shrank. The five dots re run each experiment on five random slices of the data, green means the gain held on that slice.';
const FRONTIER_GLOSS =
  'Each dot is one experiment, accuracy gained against factor slots spent. The blue path is the best trade that passed the guardrails at each spend, and the ringed dot is the winner.';

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

function Card({
  e,
  budgetLimit,
  onHover,
}: {
  e: Experiment;
  budgetLimit: number;
  onHover: (code: string | null) => void;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const landed = e.status !== 'running';
  const skipped = landed && e.gini == null;
  const verdictClass =
    e.verdictTag === 'Winner'
      ? 'winner'
      : e.verdictTag === 'Scrapped'
        ? 'scrap'
        : 'ship';

  return (
    <div
      className={`exp${on ? ' on' : ''}${e.status === 'scrapped' ? ' dim' : ''}${e.status === 'winner' ? ' win' : ''}`}
      onMouseEnter={() => onHover(e.code)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="head">
        <span className="id">{e.code}</span>
        <span className="name">{e.name}</span>
      </div>
      <div className="hyp">{e.hypothesis}</div>
      <div className="stat">
        {!landed && <span className="prog">{e.progress ?? 'queued'}</span>}
        {skipped && <span className="chip w">fit skipped</span>}
        {landed && !skipped && (
          <>
            <span className={`chip${e.status === 'scrapped' ? '' : ' g'}`}>
              {'Δ'}Gini {fmtDelta(e.deltaGini!)}
            </span>
            <span className="chip">
              {e.devianceChangePct != null
                ? fmtDev(e.devianceChangePct)
                : fmtAic(e.aicDelta ?? 0)}
            </span>
            <span className="chip">
              budget {e.budgetUsed} of {budgetLimit}
            </span>
            {e.foldsPass && (
              <span
                className="folds"
                role="img"
                aria-label={`folds: ${e.foldsPass.filter(Boolean).length} of ${e.foldsPass.length} hold`}
                title={`folds: ${e.foldsPass.filter(Boolean).length} of ${e.foldsPass.length} hold`}
              >
                {e.foldsPass.map((p, i) => (
                  <i key={i} className={p ? 'p' : 'f'} />
                ))}
              </span>
            )}
          </>
        )}
      </div>
      {!landed && (
        <div className="ghost" aria-hidden="true">
          <i style={{ width: '64%' }} />
          <i style={{ width: '42%' }} />
        </div>
      )}
      {landed && e.verdictTag && (
        <div className={`verdict ${verdictClass}`}>
          <b>{e.verdictTag}</b> · {e.verdictText}
          {e.lineage && <div className="lineage">{e.lineage}</div>}
          {e.glossText && <div className="gloss">{e.glossText}</div>}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const [run, setRun] = useState<Run | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [view, setViewState] = useState<View>(
    location.hash === '#review' || params.get('view') === 'review'
      ? 'review'
      : 'console',
  );
  const [plain, setPlain] = useState(params.get('plain') === '1');
  const [themePref, setThemePref] = useState<ThemePref>(
    (document.documentElement.dataset.themePref as ThemePref) ?? 'system',
  );
  const [error, setError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [hovered, setHovered] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const landedSeen = useRef<Set<string>>(new Set());
  const starting = useRef(false);

  const running = run?.status === 'running';
  const complete = run?.status === 'complete';

  // boot: reuse the latest run, or start a fresh one when none exists
  useEffect(() => {
    (async () => {
      try {
        let r = await fetchLatestRun();
        if (!r && !starting.current) {
          starting.current = true;
          r = await startRun();
        }
        setRun(r);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  // poll while running
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetchLatestRun();
        if (r) setRun(r);
      } catch (e) {
        setError(String(e));
      }
    }, 400);
    return () => clearInterval(iv);
  }, [running]);

  // live elapsed ticker
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setNowMs(Date.now()), 100);
    return () => clearInterval(iv);
  }, [running]);

  // fetch the review once the agent has opened it
  useEffect(() => {
    if (!run || !run.reviewId || review?.runId === run.id) return;
    fetchReview(run.id)
      .then((rv) => rv && setReview(rv))
      .catch((e) => setError(String(e)));
  }, [run, review]);

  // aria-live announcements as experiments land
  useEffect(() => {
    if (!run) return;
    for (const e of run.experiments) {
      if (e.status !== 'running' && !landedSeen.current.has(e.code)) {
        landedSeen.current.add(e.code);
        if (e.verdictTag && e.verdictText) {
          setAnnouncement(`${e.code} ${e.verdictTag}: ${e.verdictText}`);
        }
      }
    }
    if (complete && run.winnerCode) {
      setAnnouncement(
        `Run complete. ${run.winnerCode} is ready for review.`,
      );
    }
  }, [run, complete]);

  useEffect(() => {
    document.body.classList.toggle('plain', plain);
  }, [plain]);

  useEffect(() => {
    applyTheme(themePref);
  }, [themePref]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (document.documentElement.dataset.themePref === 'system')
        applyTheme('system');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setView = useCallback((v: View) => {
    setViewState(v);
    if (v === 'review' && location.hash !== '#review') location.hash = 'review';
    if (v === 'console') {
      const sp = new URLSearchParams(location.search);
      sp.delete('view');
      history.replaceState(
        null,
        '',
        location.pathname + (sp.toString() ? `?${sp}` : ''),
      );
      if (location.hash) {
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    window.scrollTo(0, 0);
    setAnnouncement(
      v === 'review'
        ? 'Model review opened.'
        : 'Back to the experiment run.',
    );
  }, []);

  useEffect(() => {
    const onHash = () => {
      const want: View = location.hash === '#review' ? 'review' : 'console';
      setViewState(want);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const replay = useCallback(async () => {
    try {
      setReview(null);
      landedSeen.current.clear();
      setViewState('console');
      const r = await startRun();
      setRun(r);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const onApprove = useCallback(async () => {
    if (!review || !run) return;
    setApproving(true);
    setApproveError(null);
    try {
      await approveReview(review.id);
      const rv = await fetchReview(run.id);
      if (rv) setReview(rv);
      setAnnouncement('Approved. New version created with the run ledger attached.');
      requestAnimationFrame(() => document.getElementById('rvStamp')?.focus());
    } catch (e) {
      setApproveError(String(e));
    } finally {
      setApproving(false);
    }
  }, [review, run]);

  const exps = run?.experiments ?? [];
  const landedCount = exps.filter((e) => e.status !== 'running').length;
  const candCount = exps.filter((e) =>
    ['candidate', 'absorbed'].includes(e.status),
  ).length;
  const scrapCount = exps.filter((e) => e.status === 'scrapped').length;
  const totalPlanned = 7;
  const budgetLimit = useMemo(() => {
    const label = run?.rails.find((r) => r.key === 'budget')?.label ?? '';
    const m = label.match(/\d+/);
    return m ? parseInt(m[0], 10) : 2;
  }, [run]);

  const elapsedText = run
    ? running
      ? `${Math.max(0, (nowMs - run.startedAtMs) / 1000).toFixed(1)}s`
      : run.elapsedMs != null
        ? `${(run.elapsedMs / 1000).toFixed(1)}s`
        : '0.0s'
    : '0.0s';

  const winner = run?.winnerCode
    ? exps.find((e) => e.code === run.winnerCode)
    : null;

  const trippedCount = (run?.rails ?? []).filter((r) => r.note).length;
  const railsGloss =
    'Hard limits the platform checks outside the agent, so they are enforced, not promised. ' +
    (trippedCount === 0
      ? 'None tripped during this run.'
      : trippedCount === 1
        ? 'One tripped during this run and scrapped an experiment, which is the rail doing its job.'
        : `${countWord(trippedCount)[0].toUpperCase()}${countWord(trippedCount).slice(1)} tripped during this run and scrapped an experiment each, which is the rail doing its job.`);

  const baselineGloss = run?.baselineGini
    ? `Gini scores how well the current model separates high risk drivers from low risk, zero is a coin flip. On a model that already carries ${countWord(run.baselineFactors ?? 9)} factors, moves of 0.01 are hard won.`
    : '';

  const goalParts = run?.goal.split('Bodily Injury Frequency v12');

  return (
    <>
      <header className="intro">
        <div className="eyebrow">Working build</div>
        <h1>Experiments</h1>
        <p>
          A working slice of the agent era of Prediction Lab: you state the
          goal and the guardrails, the modeling agent runs the grind against a
          real backend, and every experiment ends in a written verdict.
          Scrapped paths stay on the board with their reasons, so no dead end
          gets walked twice. One winner earns its way to review.
        </p>
        <div className="who">
          Ryan Allen · <a href="https://fullbuild.ai">fullbuild.ai</a> ·
          synthetic data, real fits
        </div>
      </header>

      {error && (
        <div className="banner" role="alert">
          {error.includes('fetch')
            ? 'The API is unreachable. Start the backend, then reload.'
            : error}
        </div>
      )}

      <section className="window" aria-label="Prediction Lab window">
        <div className="titlebar">
          <div className="dots">
            <i />
            <i />
            <i />
          </div>
          <div className="crumb">
            Prediction Lab<span>›</span>Models<span>›</span>Bodily Injury
            Frequency<span>›</span>
            <b>{view === 'review' ? 'Review' : 'Experiments'}</b>
          </div>
          <div className="tb-right"></div>
        </div>
        <div className="layout">
          <div className="main">
            {view === 'console' && (
              <div>
                <h2 className="sr">Experiment run</h2>
                <div className="goal">
                  <div className="ai" aria-hidden="true">
                    AI
                  </div>
                  <div>
                    <div className="txt">
                      {goalParts && goalParts.length === 2 ? (
                        <>
                          {goalParts[0]}
                          <b>Bodily Injury Frequency v12</b>
                          {goalParts[1]}
                        </>
                      ) : (
                        run?.goal ?? 'Loading the run'
                      )}
                    </div>
                    <div className="meta">
                      {run?.baselineGini != null
                        ? `baseline Gini ${fmtGini(run.baselineGini)} · `
                        : ''}
                      {run?.trainRows != null
                        ? `${fmtThousands(run.trainRows)} train rows · `
                        : ''}
                      runs on its own branch
                      {run ? ` (${run.branchName})` : ''}
                    </div>
                    <div className="gloss">{GOAL_GLOSS}</div>
                  </div>
                </div>

                <div className={`strip${running ? ' running' : ''}`}>
                  <span>
                    {running && <span className="spin" aria-hidden="true" />}
                    <span className="num">{landedCount}</span> of{' '}
                    {totalPlanned} experiments
                    {complete ? ' · run complete' : ''}
                  </span>
                  <span>
                    <span className="num">{candCount}</span>{' '}
                    {candCount === 1 ? 'candidate' : 'candidates'}
                  </span>
                  <span>
                    <span className="num">{scrapCount}</span> scrapped
                  </span>
                  <span>
                    elapsed <span className="num">{elapsedText}</span>
                  </span>
                  <button className="replay" onClick={replay} disabled={running}>
                    {running ? 'Running' : 'Replay run'}
                  </button>
                </div>

                <div className="gloss block">{GRID_GLOSS}</div>

                <div className="grid">
                  {exps.map((e) => (
                    <Card
                      key={`${run?.id}-${e.code}`}
                      e={e}
                      budgetLimit={budgetLimit}
                      onHover={setHovered}
                    />
                  ))}
                </div>

                {complete && winner && run && (
                  <div className="promote">
                    <div className="txt">
                      <div>
                        <b>{winner.code}</b> is ready for review · Gini{' '}
                        {fmtGini(winner.gini ?? 0)}, up{' '}
                        {fmtDelta(winner.deltaGini ?? 0).replace('+', '')},
                        factor budget {winner.budgetUsed} of {budgetLimit}
                      </div>
                      <div className="sub">
                        {scrapCount} scrapped with reasons logged · nothing
                        merges without human review
                      </div>
                    </div>
                    <button onClick={() => setView('review')}>
                      Open review
                    </button>
                  </div>
                )}
              </div>
            )}

            {view === 'review' &&
              (run && review ? (
                <ReviewView
                  run={run}
                  review={review}
                  onBack={() => setView('console')}
                  onApprove={onApprove}
                  approving={approving}
                  error={approveError}
                />
              ) : (
                <div>
                  <button className="back" onClick={() => setView('console')}>
                    ← Back to the run
                  </button>
                  <p style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
                    {running
                      ? 'The run is still working. The agent opens the review when a winner lands.'
                      : 'No review is open for this run.'}
                  </p>
                </div>
              ))}

            <div className="sr" aria-live="polite">
              {announcement}
            </div>
          </div>

          <aside className="rail">
            <div className="frontier">
              <h3>Frontier</h3>
              <Frontier
                experiments={exps}
                baselineGini={run?.baselineGini ?? null}
                complete={!!complete}
                winnerCode={run?.winnerCode ?? null}
                hovered={hovered}
              />
              <div className="cap">
                Lift against factor budget used. Dots land as fits finish.
                Blue holds the current frontier.
              </div>
              <div className="gloss">{FRONTIER_GLOSS}</div>
            </div>
            <div className="cons">
              <h3>Guardrails</h3>
              {(run?.rails ?? []).map((r) => (
                <div className="item" key={r.key}>
                  <span
                    className={`mark ${r.mark === 'passed' ? 'ok' : r.mark === 'enforced' ? 'warn' : 'idle'}`}
                  >
                    {r.mark === 'passed' ? '✓' : r.mark === 'enforced' ? '!' : '·'}
                  </span>
                  <div>
                    <div>{r.label}</div>
                    {r.note && <div className="gnote">{r.note}</div>}
                  </div>
                </div>
              ))}
              <div className="gloss">{railsGloss}</div>
            </div>
            <div>
              <h3>Baseline</h3>
              <div className="kv">
                <span>Model</span>
                <b>BI Frequency v{run?.baseModelVersion ?? 12}</b>
              </div>
              <div className="kv">
                <span>Gini</span>
                <b>{run?.baselineGini != null ? fmtGini(run.baselineGini) : '…'}</b>
              </div>
              <div className="kv">
                <span>Factors</span>
                <b>{run?.baselineFactors ?? '…'}</b>
              </div>
              <div className="kv">
                <span>Mean fit time</span>
                <b>
                  {complete && run?.elapsedMs != null
                    ? `${(run.elapsedMs / 1000 / totalPlanned).toFixed(1)}s`
                    : '…'}
                </b>
              </div>
              <div className="gloss">{baselineGloss}</div>
            </div>
            <div>
              <h3>Display</h3>
              <div className="swrow">
                <div className="swtxt">
                  <b>Plain terms</b>one plain English line under every result
                </div>
                <button
                  className="sw"
                  role="switch"
                  aria-checked={plain}
                  aria-label="Plain terms"
                  onClick={() => setPlain((p) => !p)}
                >
                  <i />
                </button>
              </div>
            </div>
            <div>
              <h3>Theme</h3>
              <div className="seg" role="group" aria-label="Theme">
                {(['light', 'dark', 'system'] as ThemePref[]).map((t) => (
                  <button
                    key={t}
                    aria-pressed={themePref === t}
                    onClick={() => setThemePref(t)}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="ledger">
              Every verdict is written to the run ledger with its reason, so
              scrapped paths stay on record. Nothing ships until a person
              signs the review.
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
