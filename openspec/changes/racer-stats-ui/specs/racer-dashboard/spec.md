# racer-dashboard

## ADDED Requirements

### Requirement: Instrument cluster with gear, RPM bar, and speed
The dashboard SHALL show an instrument cluster with a large central gear indicator, the current speed in km/h, and a horizontal RPM bar that fills proportionally to engine RPM and renders its upper range (final ~15%) in a distinct redline color. The RPM bar SHALL visually flash when the engine limiter is active.

#### Scenario: Normal driving
- **WHEN** telemetry reports gear 4, 5,200 rpm, 142 km/h
- **THEN** the cluster shows "4" prominently, "142" km/h, and the RPM bar filled proportionally with the redline zone marked

#### Scenario: On the limiter
- **WHEN** `engineLimiterOn` is true
- **THEN** the RPM bar (or shift indicator) flashes to signal the driver to shift

### Requirement: Status lights for driving aids and pit
The dashboard SHALL show status lights for ABS, TC, and PIT. ABS and TC lights SHALL appear dim/idle when the aid is enabled but inactive, brightly lit when the aid is actively intervening (`absInAction` / `tcInAction`), and off/muted when disabled. The PIT light SHALL be lit while `inPit` is true.

#### Scenario: TC intervenes on corner exit
- **WHEN** `tcEnabled` is true and `tcInAction` becomes true
- **THEN** the TC light switches from its idle state to brightly lit for the duration of the intervention

#### Scenario: Driving aids disabled
- **WHEN** `absEnabled` is false
- **THEN** the ABS light renders in its off/muted state

### Requirement: Pedal trace history
The dashboard SHALL show a scrolling time-series chart covering at least the last 10 seconds of throttle, brake, and clutch inputs (0–100%), rendered in distinct colors matching the driving-line gradient convention (throttle green, brake red), updating in real time.

#### Scenario: Braking event review
- **WHEN** the driver brakes hard and then reapplies throttle
- **THEN** the trace shows the brake spike followed by the throttle ramp, scrolling left as new samples arrive

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** the trace renders an empty/flat chart without errors

### Requirement: G-force meter
The dashboard SHALL show a G-force meter plotting lateral (`accGHorizontal`) versus longitudinal (`accGFrontal`) acceleration as a dot inside concentric reference rings (at least 1G and 2G), with the dot's recent path faintly visible.

#### Scenario: Hard cornering
- **WHEN** the car corners with sustained lateral acceleration of ~1.5G
- **THEN** the dot sits between the 1G and 2G rings on the corresponding lateral side

### Requirement: Live delta to best lap
The dashboard SHALL record elapsed lap time against `normalizedPos` for each lap and, once a valid best lap recording exists, display a live delta (in seconds, signed, e.g. "−0.42" / "+1.03") comparing the current lap's elapsed time at the current track position with the best lap's elapsed time at the same position. Negative (faster) deltas SHALL render in a distinct positive color and positive (slower) deltas in a warning color. Until a complete best lap has been recorded, the delta SHALL show a neutral placeholder.

#### Scenario: Faster than best lap
- **WHEN** the current lap is 0.42s ahead of the best lap at the same track position
- **THEN** the delta reads "−0.42" in the faster color

#### Scenario: First lap of the session
- **WHEN** no complete lap has been recorded yet
- **THEN** the delta area shows a neutral placeholder (e.g., "––.––") instead of a number

#### Scenario: New best lap completed
- **WHEN** a lap completes with a `lastLapMs` lower than the previous best
- **THEN** that lap's recording becomes the reference for subsequent deltas

### Requirement: Steering indicator
The dashboard SHALL show the current steering input as a horizontal indicator centered at zero, deflecting left/right proportionally to `steerAngle`.

#### Scenario: Left turn
- **WHEN** `steerAngle` is negative (left)
- **THEN** the indicator deflects to the left proportionally

### Requirement: Motorsport visual restyle
The dashboard layout SHALL be reorganized into a dense, race-engineering style: instrument cluster and lap timing prominent, track map dominant, pedal trace / G-meter / steering as supporting panels, using the existing dark theme tokens with tabular numerals for all timing and numeric readouts. The pre-session waiting screen behavior SHALL remain unchanged.

#### Scenario: Session active
- **WHEN** a session is connected and telemetry is flowing
- **THEN** the dashboard shows cluster, status lights, lap times with delta, pedal trace, G-meter, steering indicator, and the gradient track map in a single non-scrolling viewport on a typical 16:9 desktop display

#### Scenario: Waiting for the sim
- **WHEN** no session is active
- **THEN** the existing waiting screen is shown as before
