## Context

The repo is npm workspaces (`bridge`, `web`) with a `package-lock.json` and no `yarn.lock`. The
root `dev` script fans out with `concurrently`, and each branch re-enters npm to reach a workspace:

```
yarn dev  →  yarn 1.22  →  concurrently  →  npm run dev -w bridge  →  tsx watch src/index.ts
                                         └→  npm run dev -w web     →  vite
```

Yarn 1.22 exports fifteen `npm_config_*` variables into every script it spawns. Five carry values
npm 11 does not recognise, and each nested `npm run` prints one warning per unrecognised key —
hence exactly five lines per workspace, ten for `dev`, five for `dev:demo`.

Measured directly, in a scratch package outside this repo:

```
$ yarn probe                      # script body: node probe.js
npm_config_argv={"remain":[],"cooked":["run","probe"],"original":["probe"]}
npm_config_version_commit_hooks=true
npm_config_version_git_message=v%s
npm_config_version_git_tag=true
npm_config_version_tag_prefix=v
...plus ten more that npm does recognise
```

Two constraints shape the fix.

**The dependency tree is fully hoisted.** `bridge/node_modules` does not exist; `tsx`, `ws`,
`koffi`, `vite` and `concurrently` all live in the root `node_modules`, and there is exactly one
Vite (8.1.3). A root-level script can invoke any of them by bare name.

**With one exception.** `web/node_modules` exists and holds a second TypeScript:

```
root node_modules/.bin/tsc   → 5.9.3   (the bridge's typescript ^5.7.2)
web/node_modules/.bin/tsc    → 6.0.3   (web's typescript ~6.0.2)
```

`npm run build -w web` runs with cwd `web/`, which puts 6.0.3 first on PATH. That is the whole
reason the delegation exists, and it is invisible in the script text.

## Goals / Non-Goals

**Goals:**

- `yarn dev`, `yarn dev:demo`, `npm run dev` and `npm run dev:demo` all start with zero warning
  lines, whichever launcher the developer reaches for.
- `yarn build` is equally quiet.
- The same real output survives: `concurrently`'s coloured `[bridge]` / `[web]` prefixes, the
  bridge's three startup lines, and Vite's ready block with its mode badge.
- Every workspace command keeps running against the toolchain it runs against today — the same
  Vite, the same tsx, and critically the same TypeScript per workspace.

**Non-Goals:**

- Choosing a package manager. Both `yarn dev` and `npm run dev` keep working; this change makes the
  output identical rather than blessing one.
- Adding `.npmrc`, `packageManager`, `engines.npm`, or a `preinstall` guard.
- Repairing `.claude/workflow.yaml`'s `typecheck_web_command`, which has the same compiler-version
  confusion (see proposal, Impact). Real, pre-existing, and its own decision.
- Any edit under `bridge/src/` or `web/src/`.

## Decisions

### 1. Flatten `dev` and `dev:demo`; do not flatten `build`

```jsonc
"dev":      "concurrently -n bridge,web -c yellow,cyan \"tsx watch bridge/src/index.ts\" \"vite web\"",
"dev:demo": "vite web --mode demo",
"build":    "npm run --loglevel=error build -w bridge && npm run --loglevel=error build -w web",
```

Removing npm from the chain beats suppressing its output: it fixes the cause rather than the
symptom, it survives a future npm that changes its warning text, and it drops a process layer from
startup. Applied to `dev` and `dev:demo` it is safe, because everything those scripts need is
hoisted and the cwd shift is inert.

Applied to `build` the same move would be a silent regression. `tsc -b web` from a root script
resolves the root `tsc` — 5.9.3 — and would type-check `web/` with the bridge's compiler while
still exiting 0. The failure mode is the worst kind: a green gate that checked the wrong thing. So
`build` keeps `npm run ... -w`, which is load-bearing for compiler resolution, and takes
`--loglevel=error` instead. The split is not inconsistency; it is the hoisting layout showing
through.

_Alternative rejected — `web/node_modules/.bin/tsc -b web` from the root._ It would let `build`
flatten too, but it hard-codes a path npm is free to rearrange on the next install, and it reads
like a mistake to anyone who has not traced the version split.

### 2. `vite web`, not `cd web && vite`

Vite takes its root as a positional argument, and `envDir` defaults to that root — so config and
`.env` files resolve exactly as they do today. Verified against a live server on a scratch port:

```
$ vite web --port 5199
VITE v8.1.3  ready in 526 ms      # react plugin active: @react-refresh injected into index.html
$ curl -s localhost:5199/src/main.tsx -o /dev/null -w '%{http_code}\n'
200

$ vite web --mode demo --port 5199
$ curl -s localhost:5199/src/lib/demo.ts | head -1
import.meta.env = {"BASE_URL":"/","DEV":true,"MODE":"demo",...,"VITE_DEMO_MODE":"1"};
```

That last line is the one that mattered: `web/.env.demo` is still picked up, so `IS_DEMO` is still
true and demo mode still replays the recording instead of dialling the bridge.

_Alternative rejected — `cd web && vite`._ It works, but chains a shell builtin into an npm script
whose shell differs between cmd.exe and `sh`, for no gain over a documented CLI argument.

### 3. `--loglevel=error`, not `--silent`

Both suppress the warnings. `--silent` also eats the `> bridge@0.1.0 build` banner, so a failing
build loses the line saying which workspace was building. `--loglevel=error` keeps the banner and
keeps errors:

```
$ yarn plain     → 5 warn lines, then the banner, then the script output
$ yarn loglevel  → the banner, then the script output
$ yarn silent    → the script output alone
```

## Risks / Trade-offs

**The root scripts now restate the workspace script bodies, so they can drift.** If someone changes
`bridge`'s `dev` from `tsx watch src/index.ts` to something else, the root `dev` keeps running the
old command and nothing complains. → Mitigate by keeping the workspace scripts as the canonical
entry points (`npm run dev -w bridge` still works and is still correct) and noting in `CLAUDE.md`
that the root `dev` inlines them. The surface is two short commands that have not changed in the
project's history; the drift risk is real but small, and it is the price of the launcher-agnostic
fix that was chosen over suppression.

**`--loglevel=error` on `build` also mutes genuine npm warnings from those two invocations.** In
practice `npm run` emits nothing else — no deprecation or audit output on a plain script run, since
that belongs to `npm install`. → Accepted. If a real npm warning is ever needed,
`npm run build -w web` by hand shows it unfiltered.

**The bridge's cwd becomes the repo root.** Nothing reads it today, but a future `fs` call written
against a relative path would resolve differently depending on whether it was started by the root
`dev` or by `npm run dev -w bridge`. → The bridge already resolves paths from `AC_PATH` or
`import.meta.url`; keep it that way. This is a convention to preserve, not a defect introduced.

**`yarn build` gets quiet for a reason the script text does not explain.** A reader sees
`--loglevel=error` and cannot tell it exists for yarn's leaked env. → The proposal and this design
carry the reason, and `CLAUDE.md` gets one line pointing at it.

## Migration Plan

Edit, restart, observe. There is no state, no build artifact and no lockfile change, so rollback is
`git checkout package.json`. Nothing needs reinstalling: every binary the new scripts call is
already in `node_modules/.bin`.

## Open Questions

None blocking. One deferred: whether the repo should declare itself npm-only (`packageManager` plus
a `preinstall` guard) so the yarn path stops existing. That was considered and set aside — it fixes
the warnings by removing the launcher rather than by fixing the scripts, and the developer running
this repo prefers `yarn dev`. Worth revisiting only if yarn starts causing problems beyond output
noise.
