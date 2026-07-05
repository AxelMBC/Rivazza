# racer-dashboard (delta)

## ADDED Requirements

### Requirement: Hover-revealed tyre detail overlay on the instrument cluster
Hovering the instrument cluster SHALL fade in an overlay showing per-wheel tyre data in car layout (front-left / front-right on top, rear-left / rear-right below): tyre slip and wheel load (kN) from the telemetry frame's `tyreSlip` and `wheelLoad` arrays (ordered FL, FR, RL, RR). Slip values SHALL be color-graded from normal through warning to critical as slip magnitude rises. The overlay SHALL not intercept pointer events (informational only), SHALL update live while visible, and SHALL disappear when the pointer leaves the cluster. The gauges beneath SHALL keep animating while the overlay is shown.

#### Scenario: Overlay appears on hover
- **WHEN** the pointer moves over the instrument cluster
- **THEN** the per-wheel overlay fades in showing four tiles in FL/FR/RL/RR car layout with live slip and load values

#### Scenario: High slip highlighted
- **WHEN** a wheel's slip magnitude is high (e.g. wheelspin or lock-up) while the overlay is visible
- **THEN** that wheel's slip value renders in the warning/critical grading

#### Scenario: Pointer leaves
- **WHEN** the pointer leaves the cluster
- **THEN** the overlay fades out and the gauges remain unchanged

### Requirement: Information reveals are focus-safe
Any dashboard interaction that reveals additional information SHALL be driven exclusively by pointer hover or wheel scroll — never by click, keyboard input, or window focus — so the reveal works while Assetto Corsa holds input focus and clicking the browser would steal control inputs from the game.

#### Scenario: Reveal while the game has focus
- **WHEN** the browser window is unfocused and the pointer hovers a reveal trigger (Lap tile, instrument cluster, track-map lap line)
- **THEN** the associated information appears without requiring a click or focusing the window

#### Scenario: No click-gated information
- **WHEN** reviewing the dashboard's interactive surfaces
- **THEN** no information is reachable only through a click, keyboard shortcut, or focused element
