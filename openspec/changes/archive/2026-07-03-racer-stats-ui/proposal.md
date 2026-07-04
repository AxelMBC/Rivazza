# Racer Stats UI

## Why

The current dashboard is a minimal readout (speed, gear, rpm, two pedal bars, lap times) that under-uses the telemetry AC already sends: the bridge receives the full 328-byte RTCarInfo packet but parses only ~13 of its fields, discarding G-forces, steering, clutch, ABS/TC activity, tyre slip and pit status. The UI should feel like a race engineer's stats screen — dense, glanceable, and centered on how the driver is actually using the car.

## What Changes

- **Bridge parses the full RTCarInfo packet**: G-forces (frontal/horizontal/vertical), clutch, steering angle, ABS/TC enabled + in-action flags, engine-limiter flag, in-pit flag, per-wheel tyre slip and load, and car slope are added to `TelemetryFrame` and streamed to the web app.
- **Throttle/brake driving-line gradient on the track map** (the headline feature): instead of a single-color trail, the driven line is colored by pedal state — green where throttle is applied, red where braking, yellow where coasting (neither). The full current lap's line persists on the map, resetting each lap, so the driver sees their braking points and throttle application zones at a glance.
- **Racer-style instrument cluster**: large gear indicator with an RPM bar that sweeps toward a redline zone, speed readout, and ABS/TC/pit/limiter status lights that illuminate when active.
- **Pedal input history strip**: a scrolling time-series chart of throttle/brake (and clutch) over the last several seconds — the classic "pedal trace" racers use to review their inputs.
- **G-force meter**: a lateral/longitudinal G dot on a circular gauge showing cornering and braking loads.
- **Live delta to best lap**: the app records time-vs-track-position for each lap and shows a running +/− delta against the session's best lap.
- **Visual restyle**: darker, motorsport-flavored layout (denser grid, status lights, tabular numerics) built on the existing Tailwind theme tokens.

## Capabilities

### New Capabilities
- `extended-telemetry`: the bridge parses the complete RTCarInfo struct and streams the extended `TelemetryFrame` (G-forces, clutch, steering, ABS/TC/pit/limiter flags, per-wheel slip/load, slope) over the existing WebSocket.
- `driving-line-gradient`: the track map renders the current lap's driven line as a throttle/brake gradient (green = throttle, yellow = coast, red = brake), persisting for the whole lap and resetting on lap change.
- `racer-dashboard`: the redesigned dashboard UI — instrument cluster (gear/RPM/speed/status lights), pedal trace history, G-force meter, and live delta-to-best-lap readout.

### Modified Capabilities
<!-- none — no existing specs; this is the project's first spec-driven change -->

## Impact

- `bridge/src/parsers.ts`, `bridge/src/types.ts` — extend `parseRTCarInfo` and `TelemetryFrame` (additive; WebSocket message shape gains fields, no removals).
- `web/src/types.ts` — mirror the extended types.
- `web/src/components/TrackMap.tsx` — gradient driving line, per-lap trail lifecycle.
- `web/src/components/LiveStats.tsx` → replaced by new instrument-cluster / pedal-trace / G-meter components; `web/src/App.tsx` layout rework; `web/src/components/LapTimes.tsx` gains delta display.
- `web/src/index.css` — possible new theme tokens (redline, status-light colors).
- No new runtime dependencies planned; rendering stays canvas + Tailwind. No breaking changes to the bridge protocol (additive JSON fields only).
