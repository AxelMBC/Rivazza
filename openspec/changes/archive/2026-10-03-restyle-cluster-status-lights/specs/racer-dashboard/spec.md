## MODIFIED Requirements

### Requirement: Status lights for driving aids and pit
The dashboard SHALL show status lights for ABS, TC, and PIT as a single row of telltales in the instrument cluster's status-light group, directly beneath the tachometer. ABS and TC lights SHALL appear dim/idle when the aid is enabled but inactive, brightly lit when the aid is actively intervening (`absInAction` / `tcInAction`), and off/muted when disabled. The PIT light SHALL be lit while `inPit` is true. An unlit telltale (idle, off or muted) SHALL render as its label alone, with no filled background: the idle state in the secondary text colour, the off/muted state in the muted text colour at reduced opacity. Only a lit telltale SHALL render with a filled background (warning colour for ABS and TC, accent colour for PIT).

#### Scenario: TC intervenes on corner exit
- **WHEN** `tcEnabled` is true and `tcInAction` becomes true
- **THEN** the TC light switches from its idle state to brightly lit for the duration of the intervention

#### Scenario: Driving aids disabled
- **WHEN** `absEnabled` is false
- **THEN** the ABS light renders in its off/muted state

#### Scenario: Unlit telltales carry no fill
- **WHEN** ABS and TC are enabled but not intervening and the car is not in the pit lane
- **THEN** ABS, TC and PIT render as text labels in one row with no filled background

#### Scenario: Entering the pit lane
- **WHEN** `inPit` becomes true
- **THEN** the PIT telltale renders filled in the accent colour

### Requirement: Pedal input lights
The dashboard SHALL show throttle and brake as two on/off lights in the instrument cluster's status-light group, shaped as thin vertical lamps flanking the wheel-slip car glyph: throttle on the left of the car, brake on the right. Each lamp SHALL carry a small visible label ("THR" and "BRK") and SHALL be at least as tall as the car glyph's wheelbase. A light SHALL be lit while its input (`gas` for THR, `brake` for BRK) exceeds a small dead zone (5%), and dark otherwise; the lit state SHALL use the positive color for THR and the critical color for BRK (the driving-line convention). The lights SHALL show no percentage and no partial fill, and SHALL update with the throttled telemetry state.

#### Scenario: Flat out
- **WHEN** telemetry reports `gas` 1.0 and `brake` 0
- **THEN** THR is lit in the positive color and BRK is dark

#### Scenario: Trail braking
- **WHEN** telemetry reports `brake` 0.6 and `gas` 0.15
- **THEN** both THR and BRK are lit

#### Scenario: Partial throttle lights the whole lamp
- **WHEN** telemetry reports `gas` 0.3
- **THEN** the THR lamp is lit over its full height, not filled to 30%

#### Scenario: Resting a foot on the pedal
- **WHEN** telemetry reports `gas` 0.02 and `brake` 0.03
- **THEN** both lights stay dark

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** both lights render dark, without errors

### Requirement: Wheel slip lamps
The instrument cluster's status-light group SHALL show wheel slip as a single top-down car glyph: a chassis outline with four tyres in car layout (front-left and front-right at the top, rear-left and rear-right below), drawn as inline vector graphics using the gauges' outline and idle colours, placed beneath the ABS/TC/PIT telltale row. The tyres SHALL carry no FL/FR/RL/RR text labels; a tyre's position on the glyph identifies its wheel. A tyre SHALL light in the warning color while its wheel's `tyreSlip` value is above the slip-on threshold, and SHALL go dark again only once that value falls below a lower slip-off threshold. The gap between the two thresholds stops a wheel hovering at the limit from flickering at the telemetry state rate. The slip-on threshold SHALL sit just past the tyre's grip peak (normalised slip ~1). A lit tyre whose slip is at or above the tyre overlay's critical threshold SHALL render in the critical color instead of the warning color. Before any telemetry frame has been received, all four tyres SHALL render in a muted state. The glyph SHALL update with the throttled telemetry state and SHALL NOT add a canvas or a repaint input.

#### Scenario: Rear wheelspin
- **WHEN** telemetry reports rear-left and rear-right slip above the slip-on threshold and fronts below it
- **THEN** the two rear tyres of the car glyph are lit and the two front tyres are dark

#### Scenario: Front lock-up under braking
- **WHEN** telemetry reports front-left slip above the slip-on threshold while braking
- **THEN** the front-left tyre is lit and the others are dark

#### Scenario: Severe slide
- **WHEN** a wheel's slip reaches the overlay's critical threshold
- **THEN** that tyre renders in the critical color, and the overlay shows the same wheel's slip in its critical grade

#### Scenario: Slip hovering at the limit
- **WHEN** a lit wheel's slip dips below the slip-on threshold but stays above the slip-off threshold
- **THEN** its tyre stays lit

#### Scenario: Cornering at the limit without sliding
- **WHEN** every wheel's slip stays below the slip-on threshold through a corner taken at the grip limit
- **THEN** all four tyres stay dark

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** all four tyres render in the muted state, without errors

## ADDED Requirements

### Requirement: Cluster height follows the speedometer
On the desktop layout (at and above the large breakpoint), the instrument cluster's right-hand column (the tachometer plus the status-light group: the telltale row, the car glyph and the pedal lamps) SHALL be no taller than the speedometer beside it, so the speedometer's size sets the cluster's height and the status lights never push the sidebar's lower cards down.

#### Scenario: Desktop cluster
- **WHEN** the dashboard renders with a session active at 1920×1080
- **THEN** the right-hand column's height does not exceed the speedometer's rendered height

#### Scenario: Laptop cluster
- **WHEN** the dashboard renders with a session active at 1366×650
- **THEN** the right-hand column's height does not exceed the speedometer's rendered height
