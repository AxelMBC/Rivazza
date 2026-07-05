# Improve Racing Line Comparison

## Why

An on-track experiment (three laps driven deliberately outside / inside / center through every corner) produced lap lines that look identical on the track map. The recorded data is precise — positions are raw float32 world coordinates sampled every ~1 m — but the whole-track view renders the entire racing surface at 3–8 px wide while lap lines are stroked 2.5–3 px wide in one shared grey. Meter-scale line differences are mathematically invisible at that magnification, which defeats the map's purpose as a tool for studying and improving racing lines.

## What Changes

- **Scroll-wheel zoom on the track map**, anchored at the cursor, so corners can be inspected at a magnification where line choices are meters-apart-visible. Hover + scroll only — **no click, drag, or double-click anywhere** (clicking the page steals controller focus from the running game; this repo already enforces the same rule for the lap-list panel).
- **Distinct per-lap colors** for recent completed laps (stable palette assignment per lap), replacing the single shared grey, plus an on-map legend tying color → lap number → time.
- **Per-lap speed inspection on hover**: lap samples additionally record speed, and hovering near lap lines shows each nearby lap's speed at that point — the "which line actually carried more speed?" answer.
- **Higher bridge broadcast rate (30 Hz → 60 Hz)** so straight-line sample spacing stays near the intended 1 m even at top speed. Precision is never reduced anywhere: no smoothing, no simplification, raw trajectories only.

## Capabilities

### New Capabilities

- `track-map-zoom`: user-initiated scroll-wheel zoom (cursor-anchored, clamped, focus-free) layered over every track-map projection mode.
- `lap-line-comparison`: per-lap color identity for stored laps, the color legend, and hover speed readout from speed-enriched lap samples.

### Modified Capabilities

- `track-map-viewport`: the "viewport SHALL NOT pan, zoom, or re-fit" requirement is narrowed to forbid only *automatic* camera movement; user-initiated zoom is now permitted.
- `extended-telemetry`: adds a requirement that the bridge's WebSocket broadcast rate is at least 60 Hz so line sampling stays meter-scale at speed.

## Impact

- `web/src/components/TrackMap.tsx` — zoom transform in both projection modes, wheel handler, per-lap palette, legend, enriched samples, speed tooltip. The main body of the work.
- `bridge/src/index.ts` — `BROADCAST_HZ` 30 → 60.
- `web/src/hooks/useLapHistory.ts` — read-only consumer; legend reuses its records (no changes expected).
- No wire-format changes: `speedKmh` is already in every telemetry frame; both `types.ts` files stay as they are.
- Interaction constraint (project-wide): all new UI must work with hover and scroll-wheel only, without window focus.
