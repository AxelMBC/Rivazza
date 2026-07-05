## Why

The speedometer uses a hard-coded 0–320 km/h scale for every car. In a slow car most of the dial is dead space; in a fast car (F1, hypercars) the needle pegs at 320 and stops conveying anything. Matching the dial to the car being driven makes the gauge meaningful across the whole range of AC's cars.

## What Changes

- The bridge reads the current car's advertised top speed from `content/cars/<carName>/ui/ui_car.json` (`specs.topspeed`) at session handshake, alongside the existing track-asset resolution, and includes it in the session message as `topSpeedKmh`.
- Parsing is tolerant: `ui_car.json` frequently contains raw control characters that break `JSON.parse`, and `topspeed` is free text (`"211km/h"`, `"322+km/h"`, `"--km/h"`). A numeric top speed is extracted by regex; placeholder/missing/non-numeric values yield no value.
- The speedometer's maximum becomes the car's top speed plus a headroom margin, rounded up to a clean number, with the major-tick step derived from that maximum so the dial stays tidy (~6–8 divisions). The scale is **fixed for the session** (set once when the car loads).
- When no top speed is available (~15% of cars, including most F1/exotic mods), the speedometer **falls back to the current fixed 0–320 km/h scale**.
- `topSpeedKmh` is added to the `SessionInfo` type in both hand-mirrored copies (`bridge/src/types.ts`, `web/src/types.ts`).
- `InstrumentCluster` receives the session (or a derived speed max) so the speedometer can scale; it currently receives only telemetry.
- The tachometer (RPM) is unchanged.

## Capabilities

### New Capabilities
- `car-spec-resolution`: The bridge resolves per-car specifications (starting with top speed) from the AC install's `ui_car.json` and reports them on the session, tolerant of malformed JSON and free-text spec values.

### Modified Capabilities
- `racer-dashboard`: The speedometer scale changes from a fixed 0–320 km/h to a per-car scale derived from the car's top speed (with headroom, nice-rounding, and a derived tick step), falling back to the fixed 0–320 scale when top speed is unavailable.

## Impact

- **Bridge**: new car-spec resolver (sibling to `trackAssets.ts`), wired into the session handshake in `index.ts`; `SessionInfo` gains `topSpeedKmh`.
- **Web**: `SessionInfo` type mirror updated; `App.tsx` threads `session` into `InstrumentCluster`; `InstrumentCluster.tsx` computes the dynamic speed scale; `AnalogGauge` already clamps out-of-range needles, so no gauge-primitive change is required.
- **Wire format**: additive field on the `session` message — backward compatible.
- No new dependencies. No change to the RPM gauge, track map, or other panels.
