# Tasks: add-hover-reveal-panels

## 1. Lap history hook

- [x] 1.1 Create `web/src/hooks/useLapHistory.ts`: accumulate `{ lap, timeMs, invalid }` records on `lapCount` increment, guarding against a stale/zero `lastLapMs` on the incrementing frame; expose the record array
- [x] 1.2 Track per-lap `inPit` union and pre-completion `bestLapMs`; apply the two invalidity heuristics (rejected would-be best, touched pit), including the no-prior-best case
- [x] 1.3 Reset the log on session change and on the restart signature (lapCount decreasing, or same-lap `lapTimeMs` running backwards — mirror `TrackMap`'s rule)
- [x] 1.4 Wire the hook into `App.tsx` and pass the records to `LapTimes` and `TrackMap`

## 2. Lap list hover panel

- [x] 2.1 In `LapTimes.tsx`, make the Lap counter tile a `group relative` hover trigger and add the absolutely-positioned panel (`invisible/opacity-0` → `group-hover` reveal with a short transition)
- [x] 2.2 Render lap rows: lap number + `formatLapTime` in `tabular-nums`; `text-critical` for invalid laps, `text-best` for the fastest valid lap; empty-state message when no laps are recorded
- [x] 2.3 Cap panel height with `max-h` + `overflow-y-auto` so long sessions scroll on wheel without clicking; verify the panel doesn't flicker when the pointer moves within the tile

## 3. Track-map label enrichment

- [x] 3.1 Pass lap records into `TrackMap` and extend `drawHoverLabel` to append the recorded time ("Lap 3 — 1:42.118"), drawing the time in the critical color when invalid
- [x] 3.2 Fall back to the lap-number-only label when the hovered lap has no record

## 4. Tyre detail overlay

- [x] 4.1 Create the per-wheel overlay component (2×2 FL/FR/RL/RR tiles showing slip + load in kN) with slip color grading (normal → warning → critical)
- [x] 4.2 Mount it in `InstrumentCluster` as an absolutely-positioned `pointer-events-none` layer revealed by `group-hover`, keeping the gauges animating beneath

## 5. Verification against the live game

- [ ] 5.1 Confirm `lastLapMs` freshness on the `lapCount`-increment frame with the real telemetry stream; adjust the hook's wait logic if it lags a frame
- [ ] 5.2 With AC focused and the browser unfocused: verify Lap-tile hover, panel wheel-scroll, cluster hover, and map lap-line hover all work without clicking; verify a cut would-be-best lap and a pit lap show red in the panel and map label
