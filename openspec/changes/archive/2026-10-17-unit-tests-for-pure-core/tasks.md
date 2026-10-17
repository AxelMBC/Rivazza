# Add zero-dependency unit tests for the pure core and make the lap log a pure step function

## 1. Tooling

- [x] 1.1 Add `"test": "tsx --test \"bridge/src/**/*.test.ts\" \"web/src/**/*.test.ts\""` to the root `package.json`
- [x] 1.2 Add `web/tsconfig.test.json` (Node types, bundler resolution, `include: ["src/**/*.test.ts"]`), exclude `src/**/*.test.ts` from `web/tsconfig.app.json`, and reference it from `web/tsconfig.json`
- [x] 1.3 Add `{ "name": "unit tests", "run": "npm test" }` to `.claude/axl.json` checks, after `typecheck web`
- [x] 1.4 Replace the "no test framework" paragraph in `CLAUDE.md` with: tests use `node:test` via `tsx --test`, sit beside the module they test, cover pure logic only (no UI/DOM/canvas), and run as an `axl check`; drop "do not put 'run the tests' in a tasks.md"

## 2. Tests for already-pure modules

- [x] 2.1 `bridge/src/udp/parsers.test.ts`: handshake response strings (including the trailing-`%` garbage cut), RTCarInfo fields at their offsets, slip capping, handshake packet layout; buffers built inline
- [x] 2.2 `web/src/lib/lapTransition.test.ts`: first frame, restart by lap counter going back, restart by lap clock going back beyond the slack, a clock dip within the slack is not a restart, tick, same; `isLastLapFresh` cases
- [x] 2.3 `web/src/lib/lapAnalysis.test.ts`: coverage, time interpolation, sector times, best sectors, sector owners and theoretical best on small hand-built sample sets

## 3. Lap log extraction

- [x] 3.1 Write `web/src/hooks/useLapHistory.test.ts` with unit cases for the lap log (tick then settle, pit out/in, cut during the lap, rejected would-be best, restart, cuts array replaced) and the Imola replay test, with expected laps derived from `web/public/demo/imola.json`
- [x] 3.2 Extract `LapLogState`, `initialLapLog` and `stepLapLog` in `web/src/hooks/useLapHistory.ts` per design decision 3; the hook keeps its signature and returned refs
- [x] 3.3 Run `npm test` and the full `axl check`

## 4. Verification

- [x] 4.1 Run `/axl:verify`
- [x] 4.2 In AC (or the mock), drive a few laps including a pit visit and a cut: the lap list shows the same OUT/IN/INV/valid statuses and best lap as before the change, and the live INV cue lights during the cut lap
