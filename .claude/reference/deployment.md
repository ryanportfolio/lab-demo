# Deployment

> Deploy target, build output, asset paths, publish flow.

_(empty)_
## Target

Railway project `plab-experiments`, service `web`, Dockerfile builder.
Live: https://web-production-563b7.up.railway.app

## Flow (manual; no GitHub auto-deploy)

1. Merge the PR, then `git fetch origin` and note the squash commit.
2. `git worktree add --detach <temp>/deploy-<sha> <sha>` — deploy from a clean
   checkout of the merged commit, never from a session worktree.
3. Confirm `Dockerfile` is present in that worktree before uploading
   (`railway up` uploads whatever is on disk; see pitfalls 2026-08-08).
4. `railway link --project plab-experiments` then
   `railway up --service web --detach`.
5. Verify the live page serves the new asset hash from `frontend/dist`
   (`curl <url> | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`), not just HTTP 200 —
   the old build keeps answering 200 during the rollout.
