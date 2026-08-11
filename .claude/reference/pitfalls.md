# Pitfalls

> Accumulated project-specific gotchas. Dated entries, newest at the bottom. If this file exceeds ~200 lines, split by area (`pitfalls-<area>.md`) and update the CLAUDE.md index.

## Starter safety

This starter must not ship maintainer-only checkout paths, private workflow
rules, secrets, or local-machine assumptions. Put those in untracked personal
instructions or in a private fork-specific memory file instead.

Worktree changes are isolated. Before claiming a template change is available
somewhere else, verify the exact branch or checkout the user asked about. Do not
merge, pull into another checkout, or touch paths outside the current workspace
unless the user explicitly asks in the current session.

## Local preview servers: stale or wrong site (2026-07-18)

Symptom: opening a local dev/preview server shows an outdated version of the
site, or a completely different project.

Root causes:

1. **Server reuse on a busy port.** Preview tooling (and manual servers) reuse
   whatever is already bound to the port. A server left over from a prior
   session serves old code; a different project on a shared default port
   (3000/5173/8080) serves the wrong site entirely.
2. **Worktree mismatch.** Server launched from the main checkout while edits
   live in a git worktree (or the reverse) — edits never appear no matter how
   often the page reloads.
3. **Stale build output.** Serving `dist/`/`build/` without rebuilding after
   source edits.
4. **Browser cache / service worker.** Old assets persist even after the
   server itself is current.

Prevention protocol (run every time before trusting a preview):

1. Before starting: check the port (`netstat -ano | findstr :<port>` on
   Windows, `lsof -i :<port>` on Unix). Port busy → inspect the owning PID's
   command line and cwd; if they don't match the current checkout, kill it or
   start on a fresh unique port. Never assume a reused server is the right one.
2. After loading: **sentinel check** — verify the page contains a string unique
   to the change just made (via page-text extraction, not a screenshot glance).
   No sentinel visible → server is stale or wrong; stop and diagnose before
   claiming anything works.
3. Static builds: rebuild before serving; confirm output mtime is newer than
   the edited sources.
4. Staleness persists after 1–2 → hard reload, unregister service workers, or
   use a fresh browser profile.

### 2026-08-08: sqlx migration version collision took the live site down

Symptom: after deploy, Railway serves "Application failed to respond"; runtime
logs show the server panicking at boot with `run migrations: VersionMismatch(2)`.

Cause: a new migration was added as `0002_agent_actions.sql`, but version 2 was
already taken by `0002_evidence.sql` — invisible to a `CREATE TABLE` grep
because it is an `ALTER TABLE`. sqlx refuses to boot when two source migrations
share a version (or a version's checksum differs from what the deployed
`_sqlx_migrations` table recorded).

Rule: before adding a migration, `ls crates/server/migrations/` and take the
next unused number. Never infer the next version from a content grep. Fix for a
collision: renumber the new file (e.g. 0003) — never edit an already-applied
migration.

### 2026-08-08: railway up from a half-deleted worktree uploads an empty app

Symptom: build fails fast with Railpack "no language detected" (it analyzed an
essentially empty `./`), and a config-less upload also loses the Dockerfile
builder setting.

Cause: `railway up` uploads whatever is on disk. The deploy worktree had been
gutted by a partially-failed `rm -rf` (the directory was "busy"), and a later
`git checkout <sha>` only restored the commit-diff files, not the whole tree.
On Windows, a Bash shell whose *cwd* is inside the worktree — including a
background Monitor's shell — is what holds it busy.

Rule: `cd` out of the worktree (and stop monitors rooted in it) before
`rm -rf`; recreate with `git worktree add`; verify `Dockerfile` (or
`railway.json`) exists in the worktree before `railway up`.

### 2026-08-09: Playwright suite against the live-proxy preview mutates and loads production

Symptom: while the suite runs, anyone using the app (or a live-proxied local
preview) sees multi-second lag; afterwards the backend has new runs and
approvals.

Cause: the e2e specs click Replay (a full 7-experiment server-side run) and
Approve. Through `PLAB_API_TARGET=<live>` those land on the production
database and pin its CPU mid-run. The specs also assume run state (e.g.
agent-record needs the newest run unapproved), so shared-state ordering makes
results flaky across workers and sessions.

Rule: full-suite runs belong on a local backend (or a throwaway deployment).
Against the live proxy, run only the read-only specs you need, expect a
handful of extra runs/approvals if a mutating spec is included, and warn
anyone concurrently using the app.

## 2026-08-10 · A locally-built asset hash never matches Railway's

Symptom: after `railway up`, a poll waiting for the asset hash that
`npx vite build` just produced locally runs its whole window and reports a
timeout — while the deploy actually succeeded minutes earlier.

Cause: the Dockerfile pins `node:22-alpine` for the frontend stage, and this
machine runs a different Node major (24.x observed). Different Node major
means a different rollup/esbuild binary, so the same commit minifies to
different bytes and a different content hash. Local build produced
`index-CEx2U5g3.js`; Railway served `index-iutJt_xz.js` for the same commit.
`.dockerignore` already excludes `frontend/node_modules` and `frontend/dist`,
so this is not local build residue leaking in — the image builds clean and
still lands elsewhere.

Rule: never poll for a *predicted* hash. Verify a deploy by probing the thing
that changed:

- GraphQL schema → `curl -s -X POST <url>/graphql -d '{"query":"{ __type(name:\"Pt\"){ fields { name } } }"}'`
- stored data → query a fresh run's evidence and assert the new field is non-null
- server-rendered HTML → `curl <url>/record/<run> | grep <new marker>`
- frontend code → read the *served* hash first, then
  `curl <url>/assets/<that hash>.js | grep <new class name>`

The served hash is still a useful *change* signal (it differs from the previous
deploy's), just never a value you can know in advance. HTTP 200 alone proves
nothing: the old build answers 200 for the whole rollout.

## 2026-08-10 · "It passes against live" does not clear a local test failure

The live backend is shared: other sessions start runs constantly, so the newest
run — and therefore which experiment and chart the app lands on with no `exp`
parameter — changes minute to minute. A layout test can pass against the
deployed URL and fail locally on the *same source* purely because the two runs
rendered different content.

This misled a diagnosis: "pinning and comparison keep the working layout
geometrically stable" failing locally (evidence panel 807px → 789px) was read
as a dev-server-versus-production-build discrepancy. It was neither. It was a
real regression — the chart companion's uncertainty line exists in Level and
not in Change, so the panel lifted by one line on switching — fixed in #62 by
reserving two lines with `min-height` on `.chart-companion[data-variant="card"]`.

Rules: pin `exp=` and `chart=` in any test whose layout depends on content;
assert the rendered `data-kind` before interacting (see `openChart` in
`chart-companions.spec.ts`); and treat a green run against live as weak
evidence, never as proof that a local red is environmental.

## 2026-08-10 · Parallel sessions converge on the same files and duplicate each other

Several sessions run against this repo at once. On 2026-08-10, four PRs landed
or opened within roughly an hour all editing the same three files
(`frontend/src/ChartValueTable.tsx`, `frontend/src/workspace.css`,
`frontend/e2e/chart-companions.spec.ts`): #59 introduced the value table, then
#62, #64 and #65 each reworked it. Two sessions independently found and fixed
the same over-scoped test locator, and a pane-clipping fix was written twice —
once narrowly, and once properly as part of #64's placement work, which
superseded it.

Symptoms to expect: `mergeable: CONFLICTING` on a PR that was clean minutes
earlier; `main` moving *during* a rebase; and a "no checks reported" PR because
the branch conflicts.

Rules:

- `git fetch origin main` immediately before branching, and again before
  opening the PR. Assume the base is stale otherwise.
- Before writing a fix, check open PRs for the same area:
  `gh pr list --state open` and read titles — they are descriptive here. If an
  open PR already covers the surface, prefer commenting or waiting over
  shipping a second fix.
- When a conflict does appear, read the other side's diff before resolving.
  Twice on this date the other session's version was the better one, and the
  right resolution was to drop the local change entirely rather than merge both.
- Prefer branches whose diff does not touch hot shared files. Documentation,
  reference notes, and backend crates collide far less than the chart frontend.

## 2026-08-09 · StrictMode kills "skip the first effect run" refs

`main.tsx` wraps the app in `React.StrictMode`, so every mount effect runs
twice in dev (and under vite-served Playwright). A `useRef(true)`-guarded
"skip the initial run" effect fires its body on the second invocation — this
silently closed the chart studio right after a `?full=1` load. Compare
against a `usePrevious`-style ref of the actual dependency instead
(see `EvidencePanel.tsx`, `prevCode`).

### 2026-08-11: gestures must commit shared state on pointerup, not mid-drag

The value grid pushed each swept block to the chart on pointermove; any
growth of the selection-actions panel (the slice button, PR #70) then
re-rendered above the table and moved rows under a pointer still sweeping
them. Pattern: keep local visual feedback (block highlight) live during a
drag, commit shared/linked state once on pointerup, clear on pointercancel
(`ChartValueTable.tsx`, `pushSweep`). Corollary: run the FULL playwright
suite before merging chart-surface changes — the failing spec was
chart-companions' sweep test, not the feature's own spec.
