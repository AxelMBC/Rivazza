## Why

The status-light column under the tachometer has grown to nine identical filled pills in five rows
(ABS TC / FL FR / RL RR / PIT / THR BRK). They all look the same, so none of them stands out, and the
four wheel lamps spend two rows of labels on a position the layout could encode by itself. The column
is also now taller (~264 px) than the speedometer (~220 px), so it sets the whole cluster's height and
takes space from the G-force card, the sidebar element meant to absorb leftover height.

## What Changes

- **Wheel-slip lamps become one top-down car glyph.** An inline SVG chassis with four tyres in car
  position, with no FL/FR/RL/RR labels. A tyre lights in the warning colour on the same hysteresis as
  today, and in the critical colour once its slip reaches the overlay's critical grade, so the glyph
  and the hover overlay show the same grades.
- **THR and BRK become thin vertical lamps on either side of the car** (throttle left, brake right).
  They stay on/off with the same 5% dead zone and positive/critical colours. Only their shape changes.
- **ABS, TC and PIT become one row of telltales.** An unlit telltale is text only, with no fill:
  muted for a disabled aid, secondary for an enabled-but-idle one. A lit telltale is filled, as today.
- **The cluster's height follows the speedometer again.** The status group shrinks from about 150 px
  to about 80 px, so the right-hand column no longer sets the cluster's height.

## Capabilities

### New Capabilities

_None._ Every change here restyles a light the `racer-dashboard` capability already defines.

### Modified Capabilities

- `racer-dashboard`: "Status lights for driving aids and pit" (one row, text-only when unlit),
  "Pedal input lights" (vertical lamps flanking the car, still on/off), and "Wheel slip lamps"
  (car glyph replaces the labelled 2×2 grid, adds a critical grade). An ADDED requirement fixes
  the cluster's height to the speedometer.

## Impact

- `web/src/components/InstrumentCluster/index.tsx`: the status-light grid is replaced.
- New sibling module(s) in `InstrumentCluster/` for the car glyph and the telltale.
- `useWheelSlipLamps.ts` and `constants.ts` keep their thresholds. `WHEEL_LABELS` stays, because
  the hover overlay still uses it.
- No bridge, wire-type, hook-contract or canvas change. The lights still re-render with the throttled
  telemetry state and add no repaint input.
