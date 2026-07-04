# Analog Gauge Cluster

## Why

The current instrument cluster is a flat digital panel (speed number, gear digit, horizontal RPM bar). Digits communicate exact values but not rate-of-change; a classic analog needle does. Replacing the panel with a skeuomorphic twin-gauge cluster (speedometer + tachometer, styled after a real instrument: bezel, tick marks, red needle) makes the dash read like a real car's cluster and gives the driver a better at-a-glance feel for acceleration and revs.

## What Changes

- Replace the flat speed/RPM/gear panel in `InstrumentCluster` with two analog dial gauges rendered side by side:
  - **Speedometer**: fixed 0–320 km/h scale, major ticks every 40 km/h with numerals, minor ticks between, red needle, and a digital readout window (the "odometer" position) showing exact speed in km/h.
  - **Tachometer**: RPM dial with a red arc over the upper ~15% of the scale (replacing the bar's redline zone), needle flash/emphasis when the engine limiter is active, and the current gear digit displayed prominently in/near the dial.
- **Dark face styling**: black gauge faces, white ticks and numerals, metallic ring bezel, red needles — consistent with the existing dark theme tokens.
- Gauges are drawn as inline SVG (no new dependencies); needle motion smoothed with CSS transforms/transitions.
- ABS / TC / PIT status lights remain, repositioned beneath or between the gauges.
- The RPM bar and the large flat gear digit are removed (superseded by the tach and its gear display).

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `racer-dashboard`: The requirement "Instrument cluster with gear, RPM bar, and speed" changes from a digital panel with a horizontal RPM bar to a twin analog gauge cluster (speedometer + tachometer with redline arc, gear digit, digital speed readout). Status-light behavior is unchanged. Note: `racer-dashboard` currently exists as a delta spec inside the in-progress `racer-stats-ui` change — that change should be archived/synced before this one so the modification applies against the main spec.

## Impact

- **Code**: `web/src/components/InstrumentCluster.tsx` is largely rewritten; likely a new reusable `AnalogGauge` component under `web/src/components/`. Theme tokens in the Tailwind config may gain gauge-specific colors (needle red, bezel metallic) if existing tokens don't cover them.
- **Data**: No bridge/telemetry changes — consumes the existing `TelemetryFrame` fields (`speedKmh`, `rpm`, `gear`, `engineLimiterOn`, ABS/TC/pit flags).
- **Layout**: The cluster panel grows vertically (two dials vs. one text row); the left-column layout of the dashboard may need spacing adjustments.
- **Dependencies**: None added — plain SVG + CSS.
- **Sequencing**: Depends on `racer-stats-ui` being archived first so the `racer-dashboard` main spec exists to modify.
