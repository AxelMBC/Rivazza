## Context

`CLAUDE.md:44` forbids a test framework; the automated gate is four read-only checks (two typechecks, lint, format). The user's concern with tests is navigability and readability: extra files and indirection that make the codebase harder to learn. Most of the delicate logic is already pure (`parsers.ts`, `lapTransition.ts`, `lapAnalysis.ts`). The exception is the lap log: `useLapHistory.ts` reconstructs laps, validity and the settled best inside one `useEffect` over 14 `useRef`s, which cannot be exercised without a React renderer. The repo already ships a real fixture: `web/public/demo/imola.json`, 26,345 telemetry frames, 5 laps and 4 cut events, as `{ t, msg }` entries in wire order.

## Goals / Non-Goals

**Goals:** a zero-dependency runner wired into `axl check`; tests on the pure core that read as statements of behaviour; the lap log made a pure step function so it can be tested, without changing what it computes.

**Non-Goals:** UI, hook-rendering or canvas tests; coverage metrics; CI; the AI-spline parser.

## Decisions

### 1. `node:test` through `tsx --test`, not Vitest

`tsx` is already a hoisted root dependency and its `--test` flag runs Node's built-in runner with TypeScript and the web code's extensionless imports resolved. Root script: `tsx --test "bridge/src/**/*.test.ts" "web/src/**/*.test.ts"` (explicit globs, so `node_modules` and `web/dist` are never scanned). Vitest is the conventional pick for a Vite app and has watch mode and richer output, but it is a new dependency plus config for about four test files; the repo rule is not to add dependencies a task didn't need. Assertions use `node:assert/strict`.

### 2. Tests beside the module they test

`parsers.test.ts` sits next to `parsers.ts`. A top-level `tests/` tree keeps `src/` unchanged but puts each test far from its subject behind `../../web/src/...` imports and hides which modules are guarded. Colocation adds four files to a ~62-file source tree, matches the repo's "code lives next to its only consumer", and makes a module's test the first thing found when reading it.

### 3. `stepLapLog` stays in `useLapHistory.ts`

The pure step and its state type are exported from the hook's own file, above the hook. A separate `lapLog.ts` module would be the tidier split on paper, but `LapRecord`, `LapStatus`, `LAP_STATUS` and `SettledLapLog` are imported from `hooks/useLapHistory` by nine files; moving them churns those imports, and leaving them would make the new module import types back from the hook. One file that reads top-down — types, pure step, thin hook — adds nothing to navigate. Importing the file under Node pulls in `react`, which loads without a DOM.

Shape:

```ts
type LapLogState = { laps, lapCount, lapTimeMs, prevBestMs, prevLastMs, pitAtStart, pitDuring,
                     pending, cutDuring, settled, consumedCuts, seenCuts, lastFrame };
export const initialLapLog = (): LapLogState
export const stepLapLog = (state: LapLogState, frame: TelemetryFrame | null,
                           cuts: readonly CutEvent[]): LapLogState
```

It reproduces the current effect exactly, including the two identity checks that carry meaning: a new `cuts` array (replaced on session/waiting) resets the consumed-cut cursor, and `framesWaited` advances only when `frame` is a different object from the last one (the effect also re-runs on `cutSeq` alone). `frame === null` returns the initial state with the cut cursor rules preserved. The hook keeps one `useRef<LapLogState>`, calls `stepLapLog` in the same effect with the same dependencies, and keeps returning `lapsRef`, `currentLapInvalidRef` and `settledRef`. Those stay as refs whose `.current` is updated from the new state after each step, so consumers (`App.tsx`, `LapTimes`, `TrackMap`, `useLapRecordings`, `LapAnalysis`) don't change; none caches the laps array by identity (they all read `lapsRef.current` at use).

### 4. Replay test: oracle from the recording, not from the code

The replay test walks `imola.json` in order: a `session` or `waiting` status starts a fresh `cuts` array (as `useTelemetry`'s `clearFrame` does), a `cut` message is appended to it, and each step runs on a `telemetry` message or a cut. Expected values are derived from the recording itself and written as literals with the reason beside them: lap numbers from the `lapCount` ticks, lap times from the `lastLapMs` each tick settles to, and which laps are invalid from the cut events' `lapCount`. Snapshotting whatever the code outputs would only prove the code agrees with itself.

The test feeds every recorded frame (~60 Hz), while production feeds the hook the ~30 Hz throttled state. The step counts frames, not time, and a lap settles within at most `PENDING_MAX_FRAMES` new frames either way, so the log is the same; the test states this assumption.

### 5. Web test files get their own tsconfig

`tsconfig.app.json` restricts `types` to `vite/client`, so `node:test`/`node:assert` don't resolve there. Add `web/tsconfig.test.json` (Node types, bundler resolution, `include: ["src/**/*.test.ts"]`), exclude `src/**/*.test.ts` from `tsconfig.app.json`, and reference the new config from `web/tsconfig.json`, so the existing `npx tsc -b web --noEmit` check covers them and `vite build` never sees them. Bridge tests are already covered by `bridge/tsconfig.json` (`include: ["src", "scripts"]`, Node types).

### 6. Test style

Test names state behaviour in the specs' words ("a lap counter running backwards is a restart"). Parser tests build their input buffers inline with the offsets written out, as an independent oracle for `parsers.ts`'s magic numbers (the mock in `bridge/scripts/mock-ac.js` can't be imported: it opens sockets on load). No mocks, no shared test helpers until a second test file needs one. The comment policy applies to tests unchanged.

## Risks / Trade-offs

- The extraction silently changes lap behaviour → the replay test's expectations come from the recording, not from the code's output, so a behaviour change fails it; the in-game manual check covers the live path through the hook.
- Test files make folders longer → limited to four pure modules; no tests for UI code by decision.
- `tsx --test` glob handling differs by shell → globs are quoted and expanded by Node's runner, not the shell.

## Open Questions

none
