## MODIFIED Requirements

### Requirement: Pedal input lights
The dashboard SHALL show throttle and brake as two level lamps in the instrument cluster's status-light group, shaped as thin vertical lamps flanking the wheel-slip car glyph: throttle on the left of the car, brake on the right. Each lamp SHALL carry a small visible label ("THR" and "BRK") and SHALL be at least as tall as the car glyph's wheelbase. Each lamp SHALL fill from its bottom in proportion to its input (`gas` for THR, `brake` for BRK), from empty at 0 to its full height at 1, with the input clamped to that range, and SHALL render empty while the input is at or below a small dead zone (5%); the fill SHALL use the positive color for THR and the critical color for BRK (the driving-line convention) over the lamp's unlit track. The fill SHALL follow the input without an animated transition, SHALL show no percentage, and SHALL update with the throttled telemetry state.

#### Scenario: Flat out
- **WHEN** telemetry reports `gas` 1.0 and `brake` 0
- **THEN** THR is filled over its full height in the positive color and BRK is empty

#### Scenario: Trail braking
- **WHEN** telemetry reports `brake` 0.6 and `gas` 0.15
- **THEN** BRK is filled to 60% of its height in the critical color and THR to 15% of its height

#### Scenario: Partial throttle fills part of the lamp
- **WHEN** telemetry reports `gas` 0.3
- **THEN** the THR lamp is filled from its bottom to 30% of its height, not over its full height

#### Scenario: Resting a foot on the pedal
- **WHEN** telemetry reports `gas` 0.02 and `brake` 0.03
- **THEN** both lamps stay empty

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** both lamps render empty, without errors
