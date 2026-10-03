# racer-dashboard

## Purpose

Live race-engineering dashboard for an active Assetto Corsa session: instrument cluster, driving-aid status lights, lap timing with live delta, throttle/brake pedal lights, G-force meter, and steering indicator, arranged in a dense motorsport-style layout around the track map.

## Requirements

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

### Requirement: Cluster height follows the speedometer
On the desktop layout (at and above the large breakpoint), the instrument cluster's right-hand column (the tachometer plus the status-light group: the telltale row, the car glyph and the pedal lamps) SHALL be no taller than the speedometer beside it, so the speedometer's size sets the cluster's height and the status lights never push the sidebar's lower cards down.

#### Scenario: Desktop cluster
- **WHEN** the dashboard renders with a session active at 1920×1080
- **THEN** the right-hand column's height does not exceed the speedometer's rendered height

#### Scenario: Laptop cluster
- **WHEN** the dashboard renders with a session active at 1366×650
- **THEN** the right-hand column's height does not exceed the speedometer's rendered height

### Requirement: G-force meter
The dashboard SHALL show a G-force meter plotting lateral (`accGHorizontal`) versus longitudinal (`accGFrontal`) acceleration as a dot inside concentric reference rings (at least 1G and 2G), with the dot's recent path faintly visible. The meter SHALL plot each sample's lateral and longitudinal G after smoothing them with an exponential moving average of about 50 ms, so single-frame kerb and bump spikes neither jerk the dot nor widen the ring scale, while sustained loads read within ~0.15G of the car's real acceleration. The dot SHALL show the load the driver feels: toward the outside of a corner, upward under braking and downward under acceleration. The meter's scale SHALL start with 1G and 2G rings and an outer edge 0.5G beyond the outermost ring. Each time the combined acceleration exceeds that edge, the meter SHALL add the next whole-G ring and move the edge out by 1G, up to a 5G outermost ring, so a crash spike cannot balloon the scale. The scale SHALL NOT shrink back while the dashboard stays mounted, so the rings never jump during a session.

#### Scenario: Hard cornering
- **WHEN** the car corners with sustained lateral acceleration of ~1.5G
- **THEN** the dot sits between the 1G and 2G rings on the side away from the corner (right of centre in a left-hander)

#### Scenario: High-downforce car exceeds the default scale
- **WHEN** the combined acceleration first exceeds 2.5G
- **THEN** a 3G ring appears, the edge moves to 3.5G, and the scale stays widened for the rest of the session even after the car slows down

#### Scenario: Car keeps pulling harder
- **WHEN** the combined acceleration later exceeds 3.5G
- **THEN** a 4G ring appears and the edge moves to 4.5G

#### Scenario: Crash spike
- **WHEN** a wall hit produces a single 12G sample
- **THEN** the scale grows no further than a 5G outermost ring (edge at 5.5G) and the dot clamps to the edge

#### Scenario: Road car never exceeds 2.5G
- **WHEN** the combined acceleration stays at or below 2.5G for the whole session
- **THEN** the meter keeps only the 1G and 2G rings, exactly as before

#### Scenario: Braking
- **WHEN** the car brakes in a straight line at ~3G
- **THEN** the dot sits about 3G above the centre

#### Scenario: Kerb strike
- **WHEN** a single telemetry frame reads 1.5G more than the frames around it
- **THEN** the dot moves roughly half as far as that frame's spike and settles back within about 100 ms

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
The dashboard layout SHALL be reorganized into a dense, race-engineering style: instrument cluster and lap timing prominent, track map dominant, G-meter and steering as supporting panels, using the existing dark theme tokens with tabular numerals for all timing and numeric readouts. The pre-session waiting screen behavior SHALL remain unchanged.

On the desktop layout (at and above the large breakpoint) the sidebar SHALL be arranged, top to bottom, as: the instrument cluster, with the speedometer on the left and, in a column to its right, the tachometer on top and the status lights (including the pedal lights) beneath it; the lap-timing tiles; and a single supporting card holding the G-force meter with the steering indicator as a single full-width row along its bottom. The supporting card SHALL be the sidebar's only element whose height follows the available space — it fills what the fixed-height elements leave, and the meter resizes with it — so the sidebar never needs to scroll. When that leftover height is too small for a legible meter (a card slot below about 160 px), the G-force meter SHALL hide rather than render collapsed rings, and the card SHALL show the steering indicator alone, vertically centred. The G-force meter SHALL stay square (a circle of rings, never an ellipse) at every card size. Below the large breakpoint the dashboard SHALL follow the phone layout defined by the "Phone layout keeps the cluster and track map on the first screen" requirement.

#### Scenario: Session active
- **WHEN** a session is connected and telemetry is flowing on a viewport at or above the large breakpoint
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

### Requirement: Phone layout keeps the cluster and track map on the first screen
Below the large breakpoint the dashboard SHALL render as a single column that scrolls as one page, ordered top to bottom: the instrument cluster, the track map, the lap-timing tiles, the supporting G-force/steering card, and the lap analysis. No dashboard card SHALL scroll inside its own box in this layout; the page scroll is the only scroll.

The first screen — the visible viewport height left under the session header — SHALL be a fold split by height one third to the instrument cluster and two thirds to the track map. The cluster SHALL be rendered in full (speedometer, tachometer, status lights, car glyph and pedal lamps, none clipped) by scaling its contents down uniformly to fit its third, keeping their proportions and the speedometer's dominance over the tachometer; it SHALL never scale up beyond its desktop size. The fold SHALL be sized against the small (browser-chrome-visible) viewport height, so the map's bottom edge stays on screen while a mobile browser's toolbars are showing. When the viewport is too short for a usable fold (below about 384 px of fold height, for example a phone in landscape), the fold SHALL keep that minimum height and the page scrolls to reach the rest.

The lap-timing tiles, the supporting card and the lap analysis SHALL follow below the fold at their natural heights, each fully reachable by scrolling the page. The supporting card's G-force meter SHALL stay square in this layout. The desktop layout at and above the large breakpoint SHALL be unaffected.

#### Scenario: iPhone SE shows speed and position at once
- **WHEN** the dashboard renders with a session active at 375×667 CSS pixels, and again at 375×553 (the same phone with the browser's toolbars showing)
- **THEN** the whole instrument cluster and the whole track map card are visible without scrolling, the cluster has no internal scrollbar, and the track map card is about twice as tall as the cluster card

#### Scenario: Scrolling reveals the rest of the dashboard
- **WHEN** the user scrolls the page down from the first screen on a phone-width viewport
- **THEN** the lap-timing tiles, the G-force/steering card and the lap analysis appear below the track map in that order, and the page scroll reaches the bottom of the lap analysis

#### Scenario: Short landscape viewport degrades to scrolling
- **WHEN** the dashboard renders at a phone landscape viewport such as 667×375
- **THEN** the fold keeps its minimum height with the same one-third/two-thirds split, nothing is clipped, and the content past the viewport is reached by scrolling the page

#### Scenario: Track-map gestures stay on the map
- **WHEN** a touch user pinches or pans on the track map in the phone layout
- **THEN** the map zooms or pans as before and the page does not scroll; a swipe that starts on the cluster, the header, or a below-fold card scrolls the page

#### Scenario: Desktop unchanged
- **WHEN** the dashboard renders at or above the large breakpoint
- **THEN** the two-column layout, the no-scroll sidebar fit, and every element's size are identical to before this change

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

### Requirement: Information reveals are focus-safe
In any build that can drive a live session, any dashboard interaction that reveals additional information SHALL be driven exclusively by pointer hover or wheel scroll — never by click, keyboard input, or window focus — so the reveal works while Assetto Corsa holds input focus and clicking the browser would steal control inputs from the game.

A demo-replay build has no live session and no game to protect (see `demo-replay`), and SHALL instead drive its controls by click. Even there, no information SHALL be reachable only through a keyboard shortcut or a focused element.

#### Scenario: Reveal while the game has focus
- **WHEN** the browser window is unfocused in a live build and the pointer hovers a reveal trigger (Last-lap or Best-lap tile, instrument cluster, track-map lap line)
- **THEN** the associated information appears without requiring a click or focusing the window

#### Scenario: No click-gated information
- **WHEN** reviewing a live build's interactive surfaces
- **THEN** no information is reachable only through a click, keyboard shortcut, or focused element

#### Scenario: No keyboard-gated information in either mode
- **WHEN** reviewing a demo build's interactive surfaces
- **THEN** every reveal is reachable by pointer alone, with no keyboard shortcut or focused element required

### Requirement: The active interaction mode is named in the header
The session header SHALL display the build's interaction model as a labeled indicator, reading "Click mode" when controls activate on click and "Hover mode" when they activate on hover or dwell. The indicator SHALL be present in every build, not only the exceptional one, because in a hover-mode build it is the only thing distinguishing "clicks do nothing by design" from a broken page. It SHALL carry an explanation of the mode reachable without interaction beyond hover.

#### Scenario: Hover-mode build
- **WHEN** the dashboard is a live build
- **THEN** the header shows "Hover mode" alongside the connection badge

#### Scenario: Click-mode build
- **WHEN** the dashboard is a demo-replay build
- **THEN** the header shows "Click mode" alongside the demo badge
