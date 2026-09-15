## Why

Every `yarn dev` and `yarn dev:demo` opens with five `npm warn Unknown env config` lines per
workspace — ten lines of noise before the bridge or Vite says anything. Nothing in the repo is
misconfigured. Yarn 1.22 exports its own npm-compatibility settings as `npm_config_*` environment
variables, and npm 11 rejects five of them as unrecognised:

| leaked variable | npm's complaint |
| --- | --- |
| `npm_config_argv` | `Unknown env config "argv"` |
| `npm_config_version_commit_hooks` | `Unknown env config "version-commit-hooks"` |
| `npm_config_version_git_message` | `Unknown env config "version-git-message"` |
| `npm_config_version_git_tag` | `Unknown env config "version-git-tag"` |
| `npm_config_version_tag_prefix` | `Unknown env config "version-tag-prefix"` |

The warnings appear once per **nested `npm run`**, and the root scripts re-enter npm to reach each
workspace (`npm run dev -w bridge`). Run the same scripts with `npm run dev` and the output is
clean — the noise is created by the yarn → npm hop, not by the repo.

It matters more than cosmetics: the first thing a developer reads after starting the app is ten
lines telling them something "will stop working in the next major version of npm". That is a false
alarm about the wrong tool, and it buries the three lines that carry real signal — the resolved AC
install path, whether the shared-memory page mapped, and the bridge's listen address.

## What Changes

- **`dev` and `dev:demo` stop re-entering npm.** The root scripts invoke the hoisted binaries
  directly (`tsx watch bridge/src/index.ts`, `vite web`) instead of delegating through
  `npm run … -w <workspace>`. With no npm in the chain there is nothing left to emit the warnings,
  under **any** launcher — yarn, npm, or a bare `concurrently`.
- **`build` keeps its npm delegation and gains `--loglevel=error`.** Flattening `build` the same
  way would be a silent regression: the root `tsc` is TypeScript 5.9.3 (the bridge's) while `web`
  pins 6.0.3 in `web/node_modules`. Only `npm run build -w web` puts web's own compiler on PATH.
  The flag suppresses the leaked-config warnings without touching which compiler runs.
- **The startup banner keeps its real output.** `--loglevel=error` silences `npm warn`, not the
  script itself; `concurrently`'s `[bridge]` / `[web]` prefixes and the Vite ready block are
  unchanged.

Not in scope, and deliberately so: switching package managers, adding an `.npmrc`, pinning
`packageManager`, or any change to `bridge/` or `web/` source. This change touches root
`package.json` scripts and documentation only.

## Capabilities

### New Capabilities

None. This change alters no runtime behaviour of the bridge or the web app — no UDP parsing, no
WebSocket message, no rendered pixel differs. It is a developer-experience change to the repo's
npm scripts.

### Modified Capabilities

None. No requirement in `openspec/specs/` describes how the dev servers are launched, and none
needs to: the capabilities there describe telemetry, rendering and lap behaviour, all of which are
identical before and after.

**This change ships no spec deltas.** `/opsx:verify` must therefore skip
`openspec validate --type change`, which fails with "must have at least one delta" when the
`specs/` directory is empty — that failure would not be a defect.

## Impact

- **`package.json` (root)** — the `dev`, `dev:demo` and `build` script bodies. The only code file
  this change edits.
- **`CLAUDE.md`** — the Commands section documents `npm run dev` and
  `npm run build -w bridge`; the note that the bridge "runs via `tsx`, never compiled to JS" stays
  true, but the command that type-checks it is now spelled out at the root.
- **Working directory shift.** `dev` previously started the bridge with cwd `bridge/` and Vite with
  cwd `web/`; both now start from the repo root. Verified safe: `bridge/src/**` contains no
  `process.cwd()` call (`record.ts` derives its path from `import.meta.url`), `bridge/node_modules`
  does not exist so `ws`, `koffi` and `tsx` already resolve from the root, and Vite's `envDir`
  follows its positional root argument, so `web/.env.demo` still loads under `--mode demo`.
- **No dependency changes.** Nothing is added, removed or upgraded; `package-lock.json` is
  untouched.
- **Adjacent finding, not fixed here.** `.claude/workflow.yaml`'s `typecheck_web_command` is
  `npx tsc -b web --noEmit`, and its comment claims TypeScript 6.0.3. From the repo root `npx tsc`
  resolves to 5.9.3, so the gate type-checks `web/` with the bridge's compiler. That is pre-existing
  drift in the verify gate, independent of these scripts, and changing the gate is its own decision.
