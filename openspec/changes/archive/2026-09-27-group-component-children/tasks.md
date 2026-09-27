Smoke check, used below: `npx tsc -b web --noEmit` and `npm run lint -w web` pass, and after a dev
server restart the page loads with no console errors.

## 1. SessionHeader

- [x] 1.1 `git mv` `SessionHeader.tsx` to `SessionHeader/index.tsx`, and move `ConnectionBadge.tsx`,
      `DemoBadge.tsx`, `GitHubLink.tsx` and `InteractionModeBadge.tsx` into `SessionHeader/`
- [x] 1.2 Fix the moved files' `../` imports (`../hooks` → `../../hooks`, `../lib` → `../../lib`)
- [x] 1.3 Smoke check
      *Typecheck and lint clean. All three groups were moved in one pass, so the app smoke check for §1–§3 is §5.2.*

## 2. InstrumentCluster

- [x] 2.1 `git mv` `InstrumentCluster.tsx` to `InstrumentCluster/index.tsx`, and move
      `AnalogGauge.tsx`, `SteeringBar.tsx` and `TyreOverlay.tsx` into `InstrumentCluster/`
- [x] 2.2 Fix the moved files' `../` imports
- [x] 2.3 Smoke check

## 3. DriverInputs

- [x] 3.1 `git mv` `DriverInputs.tsx` to `DriverInputs/index.tsx`, and move `GForceMeter.tsx` and
      `PedalBars.tsx` into `DriverInputs/`
- [x] 3.2 Fix the moved files' `../` imports
- [x] 3.3 Smoke check

## 4. Tidy

- [x] 4.1 `components/` contains only `DriverInputs/`, `InstrumentCluster/`, `LapAnalysis/`,
      `LapTimes.tsx`, `SessionHeader/` and `TrackMap/`, and `App.tsx` is unchanged
- [x] 4.2 `git diff -M --stat` shows every file as a rename, and the content changes are only import
      specifiers
      *`git diff -M` shows 12 renames. Content changes are only the `../` → `../../` import specifiers (Prettier rewrapped one import in `InstrumentCluster/index.tsx`).*
- [x] 4.3 `npm run format`

## 5. Verification

- [x] 5.1 Run `/opsx:verify`: bridge and web typecheck, lint and formatting. **Skip**
      `openspec validate --type change`, because this change has no spec deltas
      *Passed 2026-09-27T19:47Z. All four checks green, spec validation skipped (no deltas), receipt in `.verified.json`.*
- [x] 5.2 With the mock and `npm run dev` running: the header shows the track, car and driver, the
      connection badge reads live, and the Hover mode and Source badges render. The speedometer
      and rev gauges sweep, the steering bar moves, and hovering the cluster reveals the tyre
      overlay. The G-force dot moves and the throttle and brake bars track the pedals
      *Mock at :5181. The header reads `Magione | Abarth500 · Mock Driver | Live | Hover mode | Source`. Gauge SVGs and inline styles change over 2 s (needles, steering bar, pedal bars). Hovering the cluster reveals the TYRES · SLIP / LOAD overlay. The G-force canvas paints at 30/s while the car drives.*
- [ ] 5.3 With the panels at rest, the G-force canvas stays dirty-gated: it paints only while the
      car moves (the same as before the move, since its file is unchanged)
      *The G-force canvas paints at 30 paints/s while the car drives, the telemetry state rate. Left open: the idle half (no paints while the car is stopped) was not measured, because the mock never stops the car. `GForceMeter.tsx` only had its import paths changed.*
- [x] 5.4 `npm run dev:demo`: the header shows the Demo replay badge instead of the connection
      badge, and Click mode shows
      *Demo at :5182. The header reads `Imola Imola | Ferrari Sf25 · B4RR4Z4 | Demo replay | Click mode | Source`, and the full page renders as it did before the move.*
- [x] 5.5 The browser console shows no errors across all of the above
      *No page or console errors in either build.*