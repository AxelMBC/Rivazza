## 1. Root scripts

- [x] 1.1 In root `package.json`, replace `dev` with
      `concurrently -n bridge,web -c yellow,cyan "tsx watch bridge/src/index.ts" "vite web"` —
      the workspace names, colours and ordering stay exactly as they are, so the `[bridge]` /
      `[web]` prefixes keep their current look
- [x] 1.2 Replace `dev:demo` with `vite web --mode demo` (no `concurrently`; demo mode replays a
      recording and never starts the bridge)
- [x] 1.3 Leave `build` delegating to npm and add `--loglevel=error` to both halves:
      `npm run --loglevel=error build -w bridge && npm run --loglevel=error build -w web`.
      **Do not flatten this one** — `tsc -b web` from the root would silently run TypeScript
      5.9.3 against `web/`, which pins 6.0.3 in `web/node_modules` (design, Decision 1)
- [x] 1.4 Leave `format` and `format:check` untouched — they call `prettier` directly and never
      re-enter npm, so they emit no warnings today

## 2. Documentation

- [x] 2.1 In `CLAUDE.md`, under Commands, note that root `dev` / `dev:demo` invoke `tsx` and `vite`
      directly rather than delegating to the workspaces, and that `npm run dev -w bridge` /
      `npm run dev -w web` remain valid per-workspace entry points
- [x] 2.2 Add one line recording why `build` keeps `npm run … -w`: it is what puts web's
      TypeScript 6.0.3 on PATH. Without that line the delegation looks like an oversight and the
      next person flattens it

## 3. Verification

- [x] 3.1 Run `/opsx:verify` — bridge and web typecheck, lint and formatting.
      **Skip `openspec validate --type change`**: this change ships no spec deltas, so it would
      fail with "must have at least one delta", which is not a defect (proposal, Capabilities)
- [x] 3.2 Run `yarn dev` and confirm the first output line is `[bridge]` or `[web]`, not
      `npm warn` — zero warning lines where there were ten. Confirm all three bridge startup lines
      still appear (`[map] using AC install at …`, `[shm] physics page mapped …`,
      `[bridge] http + ws listening on http://localhost:3001`) and that Vite reports ready on 5173
- [x] 3.3 Run `yarn dev:demo` and confirm zero `npm warn` lines and that Vite's ready banner still
      shows the `demo` mode badge
- [x] 3.4 With `dev:demo` running, open http://localhost:5173 and confirm the recorded lap replays
      — the position dot moves on the track map with no bridge process running. This is the real
      test that `vite web --mode demo` still loads `web/.env.demo`; a ready banner alone would not
      catch `IS_DEMO` silently turning false
- [x] 3.5 Run `npm run dev` (not yarn) and confirm it still starts both processes — the flattened
      scripts must not have become yarn-specific
- [x] 3.6 Run `yarn build` and confirm zero `npm warn` lines while the
      `> bridge@0.1.0 build` / `> web@0.0.0 build` banners still appear, then confirm
      `web/dist/` was written
- [x] 3.7 Confirm `build` still uses web's compiler: run `npx tsc -v` at the repo root (expect
      5.9.3) and `npm exec -w web -- tsc -v` (expect 6.0.3). If those two ever converge, the
      reason for task 1.3 has gone away and `build` can be flattened
