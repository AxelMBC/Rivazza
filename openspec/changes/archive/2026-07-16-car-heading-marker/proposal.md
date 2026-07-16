## Why

The track map marks the car with a plain circle, which says where the car is but nothing about which way it points or what the driver is doing with the wheel. Replacing it with a directional marker makes the map readable as a driving instrument — you can see the nose direction and steering input at a glance, mid-corner, without looking away to the steering bar.

## What Changes

- Replace the track map's circular car dot with a **wedge marker** rotated to the car's direction of travel, at the same position, footprint, and z-order as today's dot.
- Add a short **steering tick** anchored at the wedge's nose, deflecting left/right proportionally to the normalized `steerAngle` telemetry (already parsed and on the wire — no bridge changes).
- Derive **heading from motion** (AC's protocol carries no yaw): the angle of recent projected position deltas, computed in screen space so per-track X-mirrored projections can never point the nose backwards.
- Degrade gracefully: below a small speed threshold the heading holds its last value; with no heading established yet (fresh connect, stationary car) the marker falls back to the plain circle.
- Preserve everything around it: racing lines, cut markers, hover picking, zoom invariance, follow-cam smoothing, and the dirty-gated rAF loop are untouched.

## Capabilities

### New Capabilities

- `car-heading-marker`: The track map's car position marker — directional wedge shape, motion-derived heading, steering-tick deflection, low-speed/no-heading fallback, and preservation of the existing marker contract (position, screen-size zoom invariance, z-order, render idling).

### Modified Capabilities

None. Existing specs (`track-map-zoom`, `track-map-follow-cam`, `cut-markers`, `track-limits`, `track-map-viewport`) reference the "car dot" only incidentally — for z-order, zoom invariance, and follow smoothing — and those requirements continue to hold for the new marker unchanged.

## Impact

- **Code**: `web/src/components/TrackMap.tsx` only — `drawDot` becomes the wedge+tick renderer; a small heading tracker feeds it from the same position sources the map already maintains (raw frames / follow-mode smoothed trail). No bridge, protocol, or type changes (`steerAngle` is already in `TelemetryFrame` on both sides).
- **Behavior**: purely visual; no new interactions (consistent with the hover-only UI rule — the marker is not interactive).
- **Systems/deps**: none. Works identically in live, mock, and demo/replay modes since all feed the same `telemetryRef`.
