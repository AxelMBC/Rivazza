## ADDED Requirements

### Requirement: Wheel slip lamps
The instrument cluster's status-light group SHALL show four wheel-slip lamps in a 2×2 grid in car layout (FL FR on top, RL RR below), placed directly beneath the ABS and TC lights and styled like the other status lights. A lamp SHALL light in the warning color while its wheel's `tyreSlip` value is above the slip-on threshold, and SHALL go dark again only once that value falls below a lower slip-off threshold. The gap between the two thresholds stops a wheel hovering at the limit from flickering at the telemetry state rate. The slip-on threshold SHALL sit just past the tyre's grip peak (normalised slip ~1). Before any telemetry frame has been received, all four lamps SHALL render in the muted state that a disabled driving aid uses. The lamps SHALL update with the throttled telemetry state and SHALL NOT add a canvas or a repaint input.

#### Scenario: Rear wheelspin
- **WHEN** telemetry reports rear-left and rear-right slip above the slip-on threshold and fronts below it
- **THEN** the RL and RR lamps are lit and FL and FR are dark

#### Scenario: Front lock-up under braking
- **WHEN** telemetry reports front-left slip above the slip-on threshold while braking
- **THEN** the FL lamp is lit and the others are dark

#### Scenario: Slip hovering at the limit
- **WHEN** a lit wheel's slip dips below the slip-on threshold but stays above the slip-off threshold
- **THEN** its lamp stays lit

#### Scenario: Cornering at the limit without sliding
- **WHEN** every wheel's slip stays below the slip-on threshold through a corner taken at the grip limit
- **THEN** all four lamps stay dark

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** all four lamps render in the muted state, without errors

## MODIFIED Requirements

### Requirement: Hover-revealed tyre detail overlay on the instrument cluster
Hovering the instrument cluster SHALL fade in an overlay showing per-wheel tyre data in car layout (front-left / front-right on top, rear-left / rear-right below): tyre slip and wheel load (kN) from the telemetry frame's `tyreSlip` and `wheelLoad` arrays (ordered FL, FR, RL, RR). Slip values SHALL be color-graded from normal through warning to critical as slip magnitude rises, with the warning grade starting at the wheel-slip lamps' slip-on threshold, so the overlay and the lamps never disagree about which wheel is slipping. The overlay SHALL not intercept pointer events (informational only), SHALL update live while visible, and SHALL disappear when the pointer leaves the cluster. The gauges beneath SHALL keep animating while the overlay is shown.

#### Scenario: Overlay appears on hover
- **WHEN** the pointer moves over the instrument cluster
- **THEN** the per-wheel overlay fades in showing four tiles in FL/FR/RL/RR car layout with live slip and load values

#### Scenario: High slip highlighted
- **WHEN** a wheel's slip magnitude is high (e.g. wheelspin or lock-up) while the overlay is visible
- **THEN** that wheel's slip value renders in the warning/critical grading

#### Scenario: Overlay agrees with the lamps
- **WHEN** a wheel's slip crosses the slip-on threshold while the overlay is visible
- **THEN** that wheel's slip value enters the warning grade at the same moment its lamp lights

#### Scenario: Pointer leaves
- **WHEN** the pointer leaves the cluster
- **THEN** the overlay fades out and the gauges remain unchanged
