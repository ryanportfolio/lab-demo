# Commands

> Build / dev / test / deploy commands for this project.

## Frontend (from `frontend/`)

- Typecheck: `npx tsc --noEmit`
- Dev server against the live backend, no local Rust/Postgres needed:
  `PLAB_API_TARGET=https://web-production-563b7.up.railway.app npx vite --port 5273 --strictPort`
  - Port 5173 (the config default) is often held by another agent session's
    vite from a different checkout — `strictPort` makes the collision loud
    instead of silently testing someone else's code. Verify with
    `curl http://localhost:<port>/src/chartWorkspace.ts | grep <your-new-symbol>`.
  - Vite 7 binds `localhost` (IPv6 `::1` here); probe `localhost`, not `127.0.0.1`.
- E2E: `PLAB_URL=http://localhost:5273 npx playwright test e2e/<spec>` (all specs ~30s total; they reuse the backend's completed run)

## Firewall quirk (this machine)

Outbound TCP has been blocked per-exe here: node allowed, chromium not.
Chromium was unblocked on 2026-08-10, so try a direct run first — if chromium
reports `net::ERR_NETWORK_ACCESS_DENIED`, the block is back and the CONNECT
proxy below is the workaround. Start a local CONNECT proxy in node and pass it
through:

- Proxy scratch script pattern: `http.createServer` + `server.on('connect', net.connect...)` on `127.0.0.1:18888`
- `PLAB_PROXY=http://127.0.0.1:18888` (playwright.config wires it into chromium)

Localhost targets need no proxy.

## Backend (needs Rust; DB only for the server)

- `cargo run --release -p plab-datagen --bin datagen` — writes data/policies.csv
- `cargo run --release -p plab-platform --bin run-cli` — whole run on the CLI, no DB
- `DATABASE_URL=... cargo run --release -p plab-server` — migrates, seeds, serves
- `cargo test` — fitting math incl hand-computed Gini and deviance cases

## Deploy

No GitHub auto-deploy. Deploys are manual via the Railway CLI from a clean
checkout of the target commit (a `.tmp/` worktree):

- `railway link --project plab-experiments`
- `railway up --service web --detach`
- Verify the worktree is complete (`Dockerfile` present) before `railway up` —
  an incomplete upload builds an empty app (pitfalls.md 2026-08-08).
- Live URL: https://web-production-563b7.up.railway.app
