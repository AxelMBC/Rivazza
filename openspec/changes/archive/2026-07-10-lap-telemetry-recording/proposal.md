# Lap Telemetry Recording & Analysis

## Why

The dashboard already draws where the car went, but not *what the driver did* to get there — completed laps keep only position, speed, and the pedal values baked into line colors, and the only cross-lap comparison is a single live delta number. To actually improve lap times a driver needs to answer questions like "where did I brake on my best lap vs. this one?", "which corner is costing me the three tenths?", and "was I back on throttle earlier last lap?" — none of which the current session data can answer after the lap is over.

## What Changes

- Record a full-fidelity, position-indexed telemetry trace for every lap driven while the app is open: track position, elapsed time, speed, throttle, brake, gear, and steering angle per sample — session-scoped, memory-bounded, with the same restart/session-reset semantics the rest of the app uses.
- Add a **lap analysis panel**: distance-aligned speed and pedal traces for a selected lap overlaid on the session-best lap, plus a continuous time-delta trace showing exactly where time was gained and lost along the lap.
- Add **mini-sector timing**: the track is split into fixed mini-sectors by normalized position; each completed lap gets per-sector splits, colored against the session's best sector times, and the session accumulates a *theoretical best* (optimal) lap from the best individual sectors.
- Extend the track-map hover readout so hovering a point on stored lap lines also reveals each lap's throttle/brake state and gear at that point (today it shows only speed), and mark each lap's braking points on the map so brake-earlier/later differences between lines are visible at a glance.
- No bridge changes: every field needed (`normalizedPos`, `lapTimeMs`, `speedKmh`, `gas`, `brake`, `gear`, `steerAngle`) already streams in `TelemetryFrame`. This is a web-workspace-only change.

## Capabilities

### New Capabilities

- `lap-telemetry-recording`: Session-scoped, position-indexed per-lap telemetry capture (time, speed, throttle, brake, gear, steering) for the in-progress lap and a bounded history of completed laps, exposed via the established ref-based hook pattern for rAF consumers.
- `lap-analysis`: The analysis panel — speed/pedal/delta traces of a selected lap vs. the session-best lap, aligned by track position, hover-scrubbed with a synced cursor on the track map.
- `mini-sector-timing`: Fixed mini-sector splits per completed lap, best-sector coloring, and the session theoretical-best lap derived from best individual sectors.

### Modified Capabilities

- `lap-line-comparison`: The per-lap hover readout requirement extends from speed-only to speed + throttle/brake state + gear at the hovered point; a new requirement adds per-lap braking-point markers on the map.

## Impact

- **Web workspace only** (`web/src/`): new hook (`useLapRecordings` or similar) alongside the existing derived-data hooks; new analysis panel component(s); `TrackMap.tsx` hover readout and marker rendering; dashboard layout in `App.tsx` gains the analysis panel.
- **Memory**: per-lap traces at ~60 Hz for long sessions must be bounded (cap laps kept, like `MAX_LAPS = 40` on the map) — the recording store defines its own caps.
- **Rendering**: new canvas traces must follow the repo's dirty-gated rAF convention.
- **No bridge, protocol, or type-contract changes** — `TelemetryFrame` already carries every field consumed.
