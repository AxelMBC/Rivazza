## Why

The repo has no automated check of behaviour: the binary UDP parsers, the restart/lap-tick classifier, the lap-analysis maths and the lap validity rules are only exercised by running the mock or the game. Those are pure logic whose mistakes are invisible on screen (a wrong offset in a field nobody looks at, a lap marked valid that the game invalidated), so they are where a regression goes unnoticed longest.

## What Changes

- Add a unit-test runner with no new dependency: Node's built-in `node:test` + `node:assert`, run through the `tsx` already in the repo (`tsx --test`), exposed as `npm test` at the root.
- Add `npm test` as a check in `.claude/axl.json`, so every `/axl:verify` runs it.
- Test files sit beside the module they test (`parsers.test.ts` next to `parsers.ts`), and only for pure modules: `bridge/src/udp/parsers.ts`, `web/src/lib/lapTransition.ts`, `web/src/lib/lapAnalysis.ts`, and the lap log.
- Extract the lap-log bookkeeping out of `useLapHistory`'s effect (14 refs mutated in place) into a pure `stepLapLog(state, frame, cuts)` in the same file; the hook keeps its signature and return value and calls it once per update.
- Add a replay test that feeds the committed Imola recording (`web/public/demo/imola.json`) through `stepLapLog` and asserts the lap log it produces.
- Type-check web test files under their own `web/tsconfig.test.json` (Node types), kept out of the app build.
- Update `CLAUDE.md`: replace "There is no test framework … Do not invent one" with how tests work here and what they are for.

## Capabilities

### New Capabilities

None — this is tooling and a behaviour-preserving refactor.

### Modified Capabilities

None — `lap-history` behaviour is unchanged; the replay test pins it.

## Out of Scope

- Component, hook-rendering, canvas or DOM tests (no jsdom, no testing-library). The running app stays covered by `.claude/skills/verify/SKILL.md` and in-game checks.
- `bridge/src/content/aiSpline.ts`: its parser is private and reads from a path; testing it needs an exported buffer-level entry point or a binary fixture, which is a separate change.
- Trivial helpers (`format.ts`, `speedScale.ts`, `lapStatus.ts`).
- CI. The check runs locally through `axl check`; a GitHub Action is a later change.
- Coverage targets.

## Impact

- New: `package.json` `test` script; `web/tsconfig.test.json`; `bridge/src/udp/parsers.test.ts`, `web/src/lib/lapTransition.test.ts`, `web/src/lib/lapAnalysis.test.ts`, `web/src/hooks/useLapHistory.test.ts`.
- Changed: `web/src/hooks/useLapHistory.ts` (internal structure only; exports and return shape unchanged), `web/tsconfig.json` (reference), `web/tsconfig.app.json` (exclude tests), `.claude/axl.json` (one check), `CLAUDE.md` (test paragraph).
- Dependencies: none added.
