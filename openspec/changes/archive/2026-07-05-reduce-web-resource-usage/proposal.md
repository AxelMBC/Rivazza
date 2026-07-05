## Why

The dashboard runs on the same PC as Assetto Corsa, so every cycle the web app burns is a cycle the game can't use. An audit found the app does far more work than the pixels on screen require: three canvas rAF loops repaint at full display refresh (144+ Hz on gaming monitors) even when nothing changed, the track map re-projects and re-strokes every stored lap every frame, and the whole React tree re-renders 60×/sec for text nobody can read at that rate. Additionally, constants tuned for the old 30 Hz bridge were never retuned after the 60 Hz bump, so the pedal trace holds only ~6 s of history — violating the racer-dashboard spec's "at least the last 10 seconds" requirement.

## What Changes

- Canvas render loops (track map, pedal trace, G-force meter) become dirty-gated: they repaint only when their content actually changed (new telemetry, pointer/zoom interaction, resize, time-based scroll still live), and idle at ~zero cost when the game is paused or telemetry stops.
- The track map caches completed laps and the current lap's already-drawn segments on offscreen canvas layers, so a frame's work is a blit plus the few new segments — instead of re-projecting and re-stroking up to 40 laps × thousands of samples every frame.
- `useTelemetry` splits rates: `telemetryRef` keeps full 60 Hz fidelity for canvas consumers; React state (text readouts, gauges, data-derivation hooks) throttles to ~30 Hz with a trailing-edge flush so the final frame always lands.
- Side effect of the 30 Hz state rate: `useInputHistory`'s 360-sample buffer covers 12 s again, restoring the pedal trace to its spec-required window (fills the full chart width) and the G-meter path to ~2 s.
- Stale documentation corrected: CLAUDE.md's "fixed 30 Hz" throttling claim (bridge is 60 Hz) and rate comments in `useInputHistory` / `GForceMeter` / `useTelemetry`.
- Explicitly out of scope: the bridge's 60 Hz broadcast (needed for 1-meter track-map line sampling), canvas devicePixelRatio, the WebSocket wire format, and all hover/wheel interaction behavior. Everything visible must look and behave the same (the pedal trace filling its full width is the one intended visible fix).

## Capabilities

### New Capabilities
- `render-efficiency`: the dashboard's rendering pipeline does work proportional to what changed — dirty-gated canvas repaints, layered/incremental track-map drawing, and a decoupled 60 Hz data path vs ~30 Hz React text state — while preserving identical visuals and interactions.

### Modified Capabilities

<!-- none — racer-dashboard's pedal-trace requirement (≥10 s window) is unchanged; this change restores compliance with it. All other work is implementation-level with no requirement changes. -->

## Impact

- `web/src/hooks/useTelemetry.ts` — state throttling (ref stays per-message).
- `web/src/components/TrackMap.tsx` — dirty gating + offscreen layers for completed laps and incremental current-lap drawing.
- `web/src/components/PedalTrace.tsx` — dirty gate that keeps animating while samples age out (time-scrolled), then idles.
- `web/src/components/GForceMeter.tsx` — dirty gate on history change.
- `web/src/hooks/useInputHistory.ts` — comment correction only (30 Hz state rate makes CAPACITY = 12 s true again).
- `CLAUDE.md` — throttling paragraph corrected.
- No bridge code, wire types (`bridge/src/types.ts` / `web/src/types.ts`), or spec'd interaction changes.
