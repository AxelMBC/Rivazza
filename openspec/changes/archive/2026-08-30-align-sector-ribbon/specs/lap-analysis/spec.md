## MODIFIED Requirements

### Requirement: Analysis panel with distance-aligned traces
The dashboard SHALL include a lap analysis panel rendering four stacked canvas strips sharing a normalized-track-position x-axis: speed (km/h), pedals (throttle and brake overlaid, 0–100%), time delta (± seconds, zero-centered), and the mini-sector ownership ribbon. All four SHALL be projected from a single shared horizontal mapping so that a given normalized track position falls at the same x in every strip. The three trace strips SHALL plot the selected lap overlaid on the reference lap (speed and pedals show both laps; the delta strip shows selected minus reference). The reference lap SHALL be strictly the fastest valid, complete recorded lap of the session — an invalid lap SHALL never serve as reference or be presented as the session best, even when its raw time is lower. When no valid complete lap exists the selected lap SHALL render alone and the delta strip SHALL state that there is no valid lap to compare against rather than showing a bare zero line. Before any complete recorded lap exists the panel SHALL show an empty state instead of blank charts. When the selected lap is invalid, the panel's header SHALL mark it in the critical tone. The ribbon strip SHALL keep a fixed thickness independent of panel height, with the three trace strips absorbing the remaining height at fixed proportions. Canvas rendering SHALL be dirty-gated — repaint only when selection, reference, scrub position, recording contents, or canvas size change — and the ribbon's colors, which depend only on the recordings, SHALL live in the cached trace layer so that a scrub frame remains a blit plus an overlay.

#### Scenario: Comparing a lap against the session best
- **WHEN** a valid complete lap exists and the driver selects another complete lap
- **THEN** the speed and pedal strips show both laps' traces aligned by track position and the delta strip shows where the selected lap gained and lost time

#### Scenario: No complete laps yet
- **WHEN** the session has no complete recorded lap
- **THEN** the panel shows an empty-state message instead of empty axes

#### Scenario: Selected lap equals the reference
- **WHEN** the selected lap is the reference lap itself
- **THEN** the strips render the single lap and the delta strip renders flat zero

#### Scenario: Only invalid laps exist
- **WHEN** every complete recorded lap is invalid
- **THEN** the panel lists those laps and renders the selected lap's speed and pedal traces, the delta strip states that no valid lap is available as a reference, and no session best is shown

#### Scenario: Invalid lap under analysis
- **WHEN** the selected lap is invalid and a valid reference exists
- **THEN** the header marks the selected lap in the critical tone and the delta strip still compares it against the valid reference

#### Scenario: Ribbon thickness is stable
- **WHEN** the panel is rendered at its smaller and larger height breakpoints
- **THEN** the ribbon has the same thickness in both and only the trace strips grow

#### Scenario: Scrubbing does not rebuild the traces
- **WHEN** the pointer moves across the plotting area without the selection, reference, recordings or canvas size changing
- **THEN** the cached trace layer including the ribbon is reused and only the cursor, band and readout are redrawn

### Requirement: Hover scrub with cross-lap readout and track-map marker
Hovering the trace strips SHALL show a shared vertical cursor at that track position spanning **all four strips**, including the mini-sector ribbon, with numeric readouts for both laps (speed, throttle, brake, gear, and the delta value), interpolated between bracketing samples. The mini-sector slice containing the scrubbed position SHALL be highlighted as a translucent vertical band spanning all four strips, so the hovered speed, pedal and delta values are visibly attributed to a named sector. The band SHALL NOT obscure the traces or ribbon colors it overlays. The scrub position SHALL be published through a shared ref so the track map draws a marker at the corresponding point on the selected lap's line while scrubbing. Scrubbing SHALL work with hover alone — no click, no keyboard, no window focus — and the cursor, band, sector readout and map marker SHALL all disappear together when the pointer leaves the strips.

#### Scenario: Scrubbing a corner
- **WHEN** the pointer hovers the speed strip at a position mid-corner
- **THEN** all four strips show the cursor at that position, the containing sector's column is banded across all of them, the readouts show both laps' values, and the track map marks the matching point on the selected lap's line

#### Scenario: Cursor reaches the ribbon
- **WHEN** the pointer scrubs to any track position
- **THEN** the vertical cursor extends unbroken from the top of the speed strip through the bottom of the sector ribbon

#### Scenario: Scrub ends
- **WHEN** the pointer leaves the trace strips
- **THEN** the cursor, the sector band, the sector readout and the track-map marker all disappear

#### Scenario: Scrubbing over the ribbon itself
- **WHEN** the pointer moves over the sector ribbon rather than over a trace strip
- **THEN** it scrubs exactly as it does over the traces, producing the same cursor, band, readouts and map marker
