## MODIFIED Requirements

### Requirement: Instrument cluster with gear, RPM bar, and speed
The dashboard SHALL show an instrument cluster composed of two analog dial gauges rendered side by side: a speedometer and a tachometer, both with a dark face, tick marks with numerals, and a red needle whose motion is smoothly animated between telemetry updates.

The speedometer SHALL use a per-car maximum derived from the current car's top speed (`topSpeedKmh` on the session): the dial maximum is the top speed increased by a headroom margin and rounded up to a clean value, and the major-tick step is derived from that maximum so the dial shows roughly 6–8 evenly labeled divisions. This scale SHALL be fixed for the life of the session (computed once when the session's car is known). When the session provides no top speed (`topSpeedKmh` is null/absent), the speedometer SHALL fall back to a fixed 0–320 km/h scale with labeled major ticks every 40 km/h. In all cases the speedometer SHALL display the exact current speed as a digital readout (km/h, tabular numerals) in a window on the lower part of the dial face.

The tachometer SHALL use a fixed 0–10,000 rpm scale with labeled major ticks every 1,000 rpm, SHALL render the upper portion of the scale (from 8,500 rpm) as a distinct redline arc, and SHALL display the current gear prominently in a window on the lower part of the dial face. Values beyond a gauge's scale SHALL clamp the needle at the end of the scale. When the engine limiter is active, the tachometer SHALL visually flash (needle and/or gear display) to signal the driver to shift.

#### Scenario: Normal driving
- **WHEN** telemetry reports gear 4, 5,200 rpm, 142 km/h
- **THEN** the speedometer needle points at 142 on the dial with "142" km/h in its readout window, and the tachometer needle points at 5,200 with "4" shown in its gear window, outside the redline arc

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
