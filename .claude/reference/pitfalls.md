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
