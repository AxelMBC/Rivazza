# Tasks — Lap Telemetry Recording & Analysis

## 1. Recording store

- [x] 1.1 Add a `subscribeFrame(cb)` full-rate frame subscription to `useTelemetry` (invoked per WS telemetry message alongside the `telemetryRef` update; returns an unsubscribe)
- [x] 1.2 Create `web/src/hooks/useLapRecordings.ts`: `LapTelemetrySample` / `LapRecording` types, per-frame capture with strict monotonic-pos guard, exposed as `recordingsRef` + `currentRef` + version signal
- [x] 1.3 Implement lap-boundary promotion with the pending/refresh `lastLapMs` discipline (mirror `useLapHistory`), coverage-based `complete` flag ([0.05, 0.95])
- [x] 1.4 Implement session-change reset and the restart signature (lap counter or lap clock backwards — keep textually in sync with `useLapHistory`/`useLapDelta`/`TrackMap`), discarding the in-progress trace on restart
- [x] 1.5 Implement bounds: lap cap with session-best-valid pinning, per-lap sample cap marking the lap not complete; constants documented in the `MAX_SAMPLES`/`MAX_LAPS` tradition
- [x] 1.6 Wire the hook in `App.tsx` (joining validity from `useLapHistory.lapsRef` stays consumer-side)

## 2. Analysis math

- [x] 2.1 Extract/adapt the pos-interpolation helper (bracketing binary search, as in `useLapDelta`) into a shared lib usable by traces, delta, and sectors
- [x] 2.2 Implement reference-lap resolution (fastest valid complete recording) and the delta series `selected(pos) − reference(pos)`
- [x] 2.3 Implement mini-sector computation: fixed equal slices (constant ~24), per-lap slice times from interpolated boundary crossings, no time for uncovered slices; memoize by recording version
- [x] 2.4 Implement best-sector table (valid laps only) and theoretical best (sum of slice minima, only when every slice has a valid time)

## 3. Analysis panel

- [x] 3.1 Create `LapAnalysis` component skeleton: panel chrome, empty state before any complete lap, placement in the `App.tsx` grid
- [x] 3.2 Render the three stacked canvas strips (speed, pedals, delta) on a shared normalized-pos x-axis, selected lap overlaid on reference, using design tokens; dirty-gated rAF per repo convention
- [x] 3.3 Implement the lap selection list: complete laps with time + validity coloring (reuse lap-list conventions), hover-to-select with sticky last-hovered selection (no clicks anywhere), default-follows-latest until first hover, eviction fallback
- [x] 3.4 Implement hover scrub: shared vertical cursor across strips, interpolated dual-lap readout (speed/throttle/brake/gear/delta), hover-only, clears on pointer leave
- [x] 3.5 Publish scrub position through a shared ref and draw the corresponding marker on the selected lap's line in `TrackMap` (pattern of `hoveredLapRef`)
- [x] 3.6 Render the mini-sector strip with best/near/slower token coloring and the theoretical-best vs. session-best readout

## 4. Track-map additions

- [x] 4.1 Add `gear` to `TrackMap`'s `Sample` and capture it where gas/brake are sampled
- [x] 4.2 Extend the hover readout rows with gear and compact pedal-state indication per lap; add the pedal-state disambiguation at braking points
- [x] 4.3 Implement braking-onset detection (rising through threshold with hysteresis + minimum no-braking distance gate), computed once per completed lap and cached on the lap entry
- [x] 4.4 Draw braking-point ticks in lap identity colors for the colored set only (in-progress lap excluded), visibility tracking colored-set membership

## 5. Feedback iteration (post-first-drive)

- [x] 5a.1 Brake ticks reveal-only for the focused lap (map line hover / session-list row hover / open-panel selection via new `analysisLapRef`), never ambient
- [x] 5a.2 Collapse the analysis panel to a slim bar with a hover-revealed overlay above the map (Lap-tile session-list pattern); map regains full height
- [x] 5a.3 Valid-laps-only "best" everywhere: `resolveReference` drops the invalid fallback, panel session best from the valid lap log, Best-lap tile overrides a game-adopted invalid best
- [x] 5a.4 Sector strip: no-baseline slices render inert (dim) instead of "matched" gray
- [x] 5b.1 Unified focused-lap treatment on the map: session-list hover and analysis selection bring the lap's line to the front with the emphasis stroke (not just line hover), revealing its ticks and cuts
- [x] 5b.2 Out-lap start-line crossing restarts the in-progress trace (recorder + delta hook) — lap 1 records fully instead of a pit-exit sliver, so analysis unlocks after the first flying lap
- [x] 5b.3 Analysis chips list valid complete laps only; invalid laps are not reviewable
- [x] 5b.4 Handle AC's wrap-before-tick ordering: a full-lap trace that rolls over at the line before `lapCount` increments is held and consumed by the tick (recorder + delta hook) — validated by frame-sequence simulation (out-lap discard, 2-frame race, same-frame wrap+tick)

## 6. Verification

- [x] 5.1 `npm run lint -w web` and `npm run build -w web` pass
- [x] 5.2 Verify against the mock (`npm run mock -w bridge` + `npm run dev`): recordings accumulate across laps, panel traces + delta + sectors populate, scrub syncs with the map, brake ticks appear on colored laps
- [x] 5.3 Verify lifecycle edges with the mock: session restart clears recordings, out-lap flagged not complete, unfocused-window recording continues, eviction pins the best lap
  - Driven live: session reset clears everything; out-lap correctly not complete; recording is WS-event-driven by construction (not rAF/focus-dependent). Not driven live (impractical with the 90 s mock lap clock): 31-lap eviction pinning; the in-place restart signature (mock restarts always re-handshake — the code path is textually identical to useLapHistory's proven one).
  - Found and fixed during verification: best-sector table was memoized on the recording version, so a cut lap could be credited with best sectors until the next lap completed (validity lands a few frames later); now derived per render.
