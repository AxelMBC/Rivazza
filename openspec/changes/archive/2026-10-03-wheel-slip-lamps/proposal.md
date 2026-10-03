## Why

The dashboard has no way to tell the driver that a tyre has let go. The per-wheel `tyreSlip` the
bridge already streams looks like it should, but it is dead: across all 26,345 telemetry frames of the
committed Imola recording (up to 297 km/h, with `tcInAction` true in 1,187 of them) every wheel reads
exactly `0`. AC simply leaves that UDP slot (offset 148) empty. The hover tyre overlay grades a number
that has never moved, and any slip indicator built on it would never light.

## What Changes

- **Read slip from the block AC actually fills.** A spike against the real game showed RTCarInfo's
  normalised slip block at offset 164 (`ndSlip`) is live. It is identical to shared memory's
  `wheelSlip`, but available on every platform and in recordings. `tyreSlip` keeps its name and
  FL/FR/RL/RR order and is decoded from there, capped at a finite ceiling because a locked wheel
  sends values past 1e6.
- **Four wheel-slip lamps in the instrument cluster.** A 2×2 block in car layout (FL FR / RL RR) in
  the status-light column, directly under ABS/TC. Each lamp lights while its wheel is past the grip
  peak, with hysteresis so a wheel at the limit doesn't flicker.
- **The hover tyre overlay starts showing real numbers.** Its thresholds are recalibrated to the
  normalised units and shared with the lamps.
- **The mock produces slip,** so the lamps can be checked without the game.

## Capabilities

### New Capabilities

_None._ The lamps are one more status-light group in `racer-dashboard`, and the data is a fix to a field
`extended-telemetry` already defines.

### Modified Capabilities

- `extended-telemetry`: `tyreSlip` is decoded from offset 164 and capped, and the mock produces it.
- `racer-dashboard`: new "Wheel slip lamps" requirement. The tyre overlay's warning grade is tied to
  the lamps' threshold.

## Impact

- `bridge/src/udp/parsers.ts`: `tyreSlip` reads offset 164 with a cap instead of offset 148.
- `bridge/scripts/mock-ac.js`: writes slip excursions at offset 164.
- `web/src/components/InstrumentCluster/`: new lamp block in `index.tsx`, a hysteresis hook, and
  new thresholds in `TyreOverlay.tsx`.
- `packages/protocol`: no type change (`tyreSlip` stays `number[]`), and its meaning is now real.
- Demo build: `imola.json` was recorded with the dead field, so its lamps never light. A fresh
  recording fixes that. Re-recording is out of scope.
- No new dependency. No canvas is touched, so render efficiency and the rAF dirty gates are not
  affected.
