# racer-dashboard

## Purpose

Live race-engineering dashboard for an active Assetto Corsa session: instrument cluster, driving-aid status lights, lap timing with live delta, pedal trace, G-force meter, and steering indicator, arranged in a dense motorsport-style layout around the track map.

## Requirements

### Requirement: Instrument cluster with gear, RPM bar, and speed
The dashboard SHALL show an instrument cluster composed of two analog dial gauges rendered side by side: a speedometer and a tachometer, both with a dark face, tick marks with numerals, and a red needle whose motion is smoothly animated between telemetry updates.

The speedometer SHALL use a fixed 0–320 km/h scale with labeled major ticks every 40 km/h, and SHALL display the exact current speed as a digital readout (km/h, tabular numerals) in a window on the lower part of the dial face. The tachometer SHALL use a fixed 0–10,000 rpm scale with labeled major ticks every 1,000 rpm, SHALL render the upper portion of the scale (from 8,500 rpm) as a distinct redline arc, and SHALL display the current gear prominently in a window on the lower part of the dial face. Values beyond a gauge's scale SHALL clamp the needle at the end of the scale. When the engine limiter is active, the tachometer SHALL visually flash (needle and/or gear display) to signal the driver to shift.

#### Scenario: Normal driving
- **WHEN** telemetry reports gear 4, 5,200 rpm, 142 km/h
- **THEN** the speedometer needle points at 142 on the dial with "142" km/h in its readout window, and the tachometer needle points at 5,200 with "4" shown in its gear window, outside the redline arc

#### Scenario: On the limiter
- **WHEN** `engineLimiterOn` is true
- **THEN** the tachometer flashes (needle and/or gear display emphasized in the redline color) to signal the driver to shift

#### Scenario: Value beyond gauge scale
- **WHEN** telemetry reports a speed above 320 km/h
- **THEN** the speedometer needle clamps at the 320 mark while the digital readout window continues to show the exact speed

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** both gauges render at rest (needles at scale minimum) with placeholder readouts, without errors

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
