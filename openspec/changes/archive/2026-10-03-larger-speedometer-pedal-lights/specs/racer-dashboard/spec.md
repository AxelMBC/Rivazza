## MODIFIED Requirements

### Requirement: Instrument cluster with gear, RPM bar, and speed

The dashboard SHALL show an instrument cluster composed of two analog dial gauges rendered side by side: a speedometer and a tachometer, both with a dark face, tick marks with numerals, and a red needle whose motion is smoothly animated between telemetry updates. The speedometer SHALL be the dominant gauge: it SHALL be rendered visibly larger than the tachometer (approximately two-thirds of the cluster's gauge row against the tachometer's one-third), and its digital speed readout SHALL be the largest numeral in the cluster.

The speedometer SHALL use a per-car maximum derived from the current car's top speed (`topSpeedKmh` on the session): the dial maximum is the top speed increased by a headroom margin and rounded up to a clean value, and the major-tick step is derived from that maximum so the dial shows roughly 6–8 evenly labeled divisions. This scale SHALL be fixed for the life of the session (computed once when the session's car is known). When the session provides no top speed (`topSpeedKmh` is null/absent), the speedometer SHALL fall back to a fixed 0–320 km/h scale with labeled major ticks every 40 km/h. In all cases the speedometer SHALL display the exact current speed as a digital readout (km/h, tabular numerals) in a window on the lower part of the dial face.

The tachometer SHALL use a fixed 0–10,000 rpm scale with labeled major ticks every 1,000 rpm, SHALL render the upper portion of the scale (from 8,500 rpm) as a distinct redline arc, and SHALL display the current gear prominently in a window on the lower part of the dial face. Values beyond a gauge's scale SHALL clamp the needle at the end of the scale. When the engine limiter is active, the tachometer SHALL visually flash (needle and/or gear display) to signal the driver to shift.

#### Scenario: Normal driving

- **WHEN** telemetry reports gear 4, 5,200 rpm, 142 km/h
- **THEN** the speedometer needle points at 142 on the dial with "142" km/h in its readout window, and the tachometer needle points at 5,200 with "4" shown in its gear window, outside the redline arc

#### Scenario: Speedometer is the dominant gauge

- **WHEN** the cluster renders with a session active
- **THEN** the speedometer dial is wider than the tachometer dial (roughly a two-thirds / one-third split of the gauge row) and its speed readout is rendered larger than the gear numeral

#### Scenario: Speedometer scaled to the car

- **WHEN** the session reports a car top speed of 211 km/h
- **THEN** the speedometer dial maximum is a clean value above 211 (top speed plus headroom, rounded up) with evenly labeled major ticks, so that 211 km/h sits comfortably inside the scale rather than at the extreme end

#### Scenario: No top speed available for the car

- **WHEN** the session reports no top speed (`topSpeedKmh` is null)
- **THEN** the speedometer uses the fixed 0–320 km/h scale with major ticks every 40 km/h

#### Scenario: On the limiter

- **WHEN** `engineLimiterOn` is true
- **THEN** the tachometer flashes (needle and/or gear display emphasized in the redline color) to signal the driver to shift

#### Scenario: Value beyond gauge scale

- **WHEN** telemetry reports a speed above the speedometer's current maximum
- **THEN** the speedometer needle clamps at the maximum mark while the digital readout window continues to show the exact speed

#### Scenario: No telemetry

- **WHEN** no telemetry frame has been received
- **THEN** both gauges render at rest (needles at scale minimum) with placeholder readouts, without errors

### Requirement: Motorsport visual restyle

The dashboard layout SHALL be reorganized into a dense, race-engineering style: instrument cluster and lap timing prominent, track map dominant, G-meter and steering as supporting panels, using the existing dark theme tokens with tabular numerals for all timing and numeric readouts. The pre-session waiting screen behavior SHALL remain unchanged.

On the desktop layout (at and above the large breakpoint) the sidebar SHALL be arranged, top to bottom, as: the instrument cluster, with the speedometer on the left and, in a column to its right, the tachometer on top and the status lights (including the pedal lights) beneath it; the lap-timing tiles; and a single supporting card holding the G-force meter with the steering indicator as a single full-width row along its bottom. The supporting card SHALL be the sidebar's only element whose height follows the available space — it fills what the fixed-height elements leave, and the meter resizes with it — so the sidebar never needs to scroll. When that leftover height is too small for a legible meter (a card slot below about 160 px), the G-force meter SHALL hide rather than render collapsed rings, and the card SHALL show the steering indicator alone, vertically centred. The G-force meter SHALL stay square (a circle of rings, never an ellipse) at every card size. Below the large breakpoint the stacked layout MAY scroll as before.

#### Scenario: Session active

- **WHEN** a session is connected and telemetry is flowing
- **THEN** the dashboard shows cluster, status and pedal lights, steering indicator, lap times with delta, G-meter, and the gradient track map in a single non-scrolling viewport

#### Scenario: Desktop and laptop viewports fit without scrolling

- **WHEN** the dashboard renders with a session active at any viewport from 1366×650 up to 1920×1080 CSS pixels
- **THEN** the sidebar's content height does not exceed its visible height — no sidebar scrollbar appears, the steering indicator is visible, and the G-force meter is either fully visible and circular or hidden entirely

#### Scenario: Supporting card absorbs the leftover height

- **WHEN** the viewport height changes between those sizes
- **THEN** only the G-force card changes height; the cluster and timing tiles keep their size, and the G-force meter remains circular

#### Scenario: Too little height for a legible G-force meter

- **WHEN** the dashboard renders at 1366×650, where the sidebar leaves the supporting card less than about 160 px
- **THEN** the card shows only the steering indicator — no collapsed rings — and the G-force meter reappears above it as soon as the viewport is tall enough

#### Scenario: Waiting for the sim

- **WHEN** no session is active
- **THEN** the existing waiting screen is shown as before

## ADDED Requirements

### Requirement: Pedal input lights

The dashboard SHALL show throttle and brake as two on/off lights labeled "THR" and "BRK" in the instrument cluster's status-light group beneath the tachometer, alongside the ABS, TC, and PIT lights and styled like them. A light SHALL be lit while its input (`gas` for THR, `brake` for BRK) exceeds a small dead zone (5%), and dark otherwise; the lit state SHALL use the positive color for THR and the critical color for BRK (the driving-line convention). The lights SHALL show no percentage and SHALL update with the throttled telemetry state.

#### Scenario: Flat out

- **WHEN** telemetry reports `gas` 1.0 and `brake` 0
- **THEN** THR is lit in the positive color and BRK is dark

#### Scenario: Trail braking

- **WHEN** telemetry reports `brake` 0.6 and `gas` 0.15
- **THEN** both THR and BRK are lit

#### Scenario: Resting a foot on the pedal

- **WHEN** telemetry reports `gas` 0.02 and `brake` 0.03
- **THEN** both lights stay dark

#### Scenario: No telemetry

- **WHEN** no telemetry frame has been received
- **THEN** both lights render dark, without errors

## REMOVED Requirements

### Requirement: Live pedal bars

**Reason**: Replaced by the on/off pedal input lights; the bars' percentage readout was not glanceable mid-corner, and removing them frees the supporting card to shrink as the speedometer grows.
**Migration**: Pedal state is shown by the THR / BRK lights beneath the tachometer (see "Pedal input lights"). Exact pedal traces per lap remain available in the lap analysis panel.
