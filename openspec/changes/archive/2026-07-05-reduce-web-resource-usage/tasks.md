## 1. Telemetry state throttling

- [x] 1.1 In `web/src/hooks/useTelemetry.ts`, keep `telemetryRef` updating on every telemetry message but throttle `setTelemetry` to ~30 Hz (skip if <33 ms since last state update); never throttle `status`/`session` messages
- [x] 1.2 Add a trailing-edge flush: when a frame is skipped, arm/re-arm a ~33 ms timeout that applies the latest frame to state; clear it on socket close/cleanup
- [x] 1.3 Update stale rate comments: `useTelemetry.ts` (document the two rates), `useInputHistory.ts` (`CAPACITY = 360` = 12 s at the 30 Hz state rate), `GForceMeter.tsx` (`PATH_SAMPLES = 60` ≈ 2 s)

## 2. TrackMap dirty gating and offscreen layers

- [x] 2.1 Add a dirty check at the top of the rAF `draw` in `web/src/components/TrackMap.tsx`: repaint only when the telemetry frame identity, mouse position/presence, zoom, canvas CSS size/dpr, or fallback-view easing state changed since the last draw
- [x] 2.2 Add a completed-laps offscreen canvas rendered with the existing `drawUniformPath` logic (all previous laps except the hovered one); re-render it only when lap count, zoom, size/dpr, projection inputs (mapData / fallback view), or hovered-lap index change
- [x] 2.3 Add an incremental current-lap offscreen canvas: append only new segments per frame using the existing `segmentColor`/jump-skip logic; fully redraw it on zoom/size/view change, lap rollover, or session reset
- [x] 2.4 Compose the main frame in the existing order — map image → completed-laps layer → current-lap layer → hovered lap emphasis → hover readout — car dot — and verify pixels match the pre-change output
- [x] 2.5 Add a convergence epsilon to the fallback-mode viewport easing (snap to target when within ε) so the map can go idle on tracks without map assets
- [x] 2.6 Set `canvas.style.cursor` only when its value actually changes

## 3. PedalTrace and GForceMeter dirty gating

- [x] 3.1 In `web/src/components/PedalTrace.tsx`, gate the rAF loop: repaint while any sample is younger than `WINDOW_MS` or size/dpr changed; after the history empties or fully ages out, do one final clearing draw then idle
- [x] 3.2 In `web/src/components/GForceMeter.tsx`, gate the rAF loop: repaint only when the history changed (length + last sample timestamp) or size/dpr changed

## 4. Documentation

- [x] 4.1 Correct the CLAUDE.md throttling paragraph: bridge broadcasts at 60 Hz; the web app throttles React text state to ~30 Hz while canvas consumers read the full-rate ref

## 5. Verification

- [x] 5.1 Run `npm run mock -w bridge` + `npm run dev`; confirm gauges, lap tiles, delta, steering bar, status lights, and tyre overlay look and behave identically (verified via headless-Chrome CDP screenshots; zero console errors)
- [x] 5.2 Confirm the pedal trace now fills the full chart width with 12 s of history (screenshot-verified)
- [x] 5.3 Exercise the track map: line colors, hover emphasis + readout, wheel zoom anchoring, lap legend, lap completion, and session restart all behave as before (hover/zoom/legend/lap-completion verified live in map-bounds mode; in-session restart and pure-fallback easing verified by code inspection — mock can't trigger them)
- [x] 5.4 Frozen the telemetry stream mid-session (game-paused state): readouts settled on the final frame, pedal trace drained, then measured **0 canvas clears in 4 s** via instrumented clearRect; hover still repainted and the stream resumed cleanly at ~147 clears/s
- [ ] 5.5 Compare CPU/GPU in Chrome Task Manager before/after while the mock streams — needs the user's real display/game (headless numbers aren't representative); repaint-rate proxy measured live ≈146/s vs idle 0/s
- [x] 5.6 `npm run lint -w web` and `npm run build -w web` pass
