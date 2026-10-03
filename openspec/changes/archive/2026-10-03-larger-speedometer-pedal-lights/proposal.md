## Why

The speedometer is the readout a driver glances at most, yet it shares the cluster 50/50 with the
tachometer and its digital speed sits in a small `text-sm` window — it is hard to read at a glance.
The throttle/brake bars beside the G-force meter carry a percentage nobody reads mid-corner; what
matters at a glance is simply _is the pedal pressed or not_, which a light conveys faster than a
bar height.

## What Changes

- The cluster is rearranged: the speedometer sits on the left, and a column to its right stacks
  the tachometer and the status lights (the separate status-light row goes). The steering indicator
  moves into the G-force card as a single row along its bottom.
- The speedometer becomes the dominant gauge in the cluster: it takes roughly two-thirds of the row
  and the tachometer shrinks to roughly one-third. Its digital speed readout grows to a large, bold numeral.
- THR and BRK become on/off status lights in the cluster's status-light group, beside ABS / TC / PIT:
  lit (throttle in the positive color, brake in the critical color) while the pedal is pressed
  past a small dead zone, dark otherwise.
- **BREAKING (UI):** the live pedal bars and their percentage readouts are removed. The supporting
  card holds only the G-force meter and, as the cluster grows taller, gets smaller — it remains the
  one element absorbing the sidebar's leftover height, so the sidebar still never scrolls.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `racer-dashboard`: the instrument-cluster requirement makes the speedometer the dominant, larger
  gauge; the "Live pedal bars" requirement is removed and replaced by on/off pedal lights in the
  status-light group; the layout requirement's supporting card now holds the G-force meter alone.

## Impact

- `web/src/components/InstrumentCluster/index.tsx` — gauge column split, larger speed readout, two
  new lights, and the tachometer and status lights stacked in a column to the right of the speedometer;
  `SteeringBar.tsx` moves from `InstrumentCluster/` to `DriverInputs/`.
- `web/src/components/DriverInputs/` — `PedalBars.tsx` deleted; `index.tsx` card holds only
  `GForceMeter`.
- `web/src/App.tsx` — the supporting card's minimum height may drop so the shorter card still fits
  at 1366×650.
- No bridge, protocol, or wire changes: `gas` and `brake` are already on every telemetry frame.
