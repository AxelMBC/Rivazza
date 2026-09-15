## MODIFIED Requirements

### Requirement: Hover scrub with cross-lap readout and track-map marker
Hovering the trace strips SHALL show a shared vertical cursor at that track position spanning **all four strips**, including the mini-sector ribbon, with numeric readouts for both laps (speed, throttle, brake, gear, and the delta value), interpolated between bracketing samples. The mini-sector slice containing the scrubbed position SHALL be highlighted as a translucent vertical band spanning all four strips, so the hovered speed, pedal and delta values are visibly attributed to a named sector. The band SHALL NOT obscure the traces or ribbon colors it overlays. The scrub position SHALL be published through a shared ref so the track map draws a marker at the corresponding point on the selected lap's line while scrubbing. **The scrubbed sector SHALL be published on that same channel alongside the position**, so the map can emphasize that sector on the track; the panel remains the one place a pointer position is resolved to a sector, and the map never re-derives it. Scrubbing SHALL work with hover alone — no click, no keyboard, no window focus — and the cursor, band, sector readout, map marker and the map's sector emphasis SHALL all appear and disappear together when the pointer enters and leaves the strips.

#### Scenario: Scrubbing a corner
- **WHEN** the pointer hovers the speed strip at a position mid-corner
- **THEN** all four strips show the cursor at that position, the containing sector's column is banded across all of them, the readouts show both laps' values, and the track map marks the matching point on the selected lap's line

#### Scenario: Cursor reaches the ribbon
- **WHEN** the pointer scrubs to any track position
- **THEN** the vertical cursor extends unbroken from the top of the speed strip through the bottom of the sector ribbon

#### Scenario: Panel band and map emphasis name the same sector
- **WHEN** the pointer rests at a track position and the panel bands one slice column
- **THEN** the sector published to the map is that same sector, so the map's emphasis and the panel's band never disagree

#### Scenario: Scrub ends
- **WHEN** the pointer leaves the trace strips
- **THEN** the cursor, the sector band, the sector readout, the track-map marker and the map's sector emphasis all disappear

#### Scenario: Scrubbing over the ribbon itself
- **WHEN** the pointer moves over the sector ribbon rather than over a trace strip
- **THEN** it scrubs exactly as it does over the traces, producing the same cursor, band, readouts and map marker
