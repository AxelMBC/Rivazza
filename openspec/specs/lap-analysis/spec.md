# lap-analysis

## Purpose
TBD - created by syncing change lap-telemetry-recording. Update Purpose after review.

## Requirements

### Requirement: Analysis panel with distance-aligned traces
The dashboard SHALL include a lap analysis panel rendering three stacked canvas strips sharing a normalized-track-position x-axis: speed (km/h), pedals (throttle and brake overlaid, 0–100%), and time delta (± seconds, zero-centered). The strips SHALL plot the selected lap overlaid on the reference lap (speed and pedals show both laps; the delta strip shows selected minus reference). The reference lap SHALL be strictly the fastest valid, complete recorded lap of the session — an invalid lap SHALL never serve as reference or be presented as the session best, even when its raw time is lower; with no valid complete lap the selected lap renders alone with no delta. Before any complete recorded lap exists the panel SHALL show an empty state instead of blank charts. Canvas rendering SHALL be dirty-gated — repaint only when selection, reference, scrub position, recording contents, or canvas size change.

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
- **THEN** the panel stays at its empty state (no reviewable laps), and no session best is shown

### Requirement: Panel collapsed to a bar until hovered
The analysis panel SHALL NOT occupy dashboard space by default: the track map keeps its full area and the panel renders as a slim always-visible bar (title plus a summary such as lap count and session best). Hovering the bar SHALL pop the full panel out as an overlay floating above the bar (over the map), which stays open while the pointer remains inside the bar or panel and closes when the pointer leaves — no click, keyboard, or window focus at any point. The session best shown in the bar and panel SHALL be the fastest valid lap only.

#### Scenario: Idle dashboard keeps the map dominant
- **WHEN** the pointer is elsewhere on the dashboard
- **THEN** only the slim bar is visible and the track map has its full height

#### Scenario: Hover opens, leave closes
- **WHEN** the pointer moves onto the bar and then up into the opened panel
- **THEN** the panel stays open throughout, and it closes when the pointer leaves the panel

#### Scenario: Invalid fastest lap is not the session best
- **WHEN** the raw-fastest lap is invalid and a slower valid lap exists
- **THEN** the bar and panel show the valid lap's time as session best

### Requirement: Lap selection list
The panel SHALL list only valid complete recorded laps (user directive: an invalidated lap is not reviewable and never appears as a chip), with lap number and recorded time, the fastest in the best-lap accent. Selection SHALL be hover-only — hovering a row selects that lap for analysis, and the selection persists after the pointer leaves (the last-hovered lap stays selected); no click, keyboard, or window focus is required for any part of it. The selection SHALL default to the most recent valid complete lap and SHALL follow new laps as they complete until the driver has hovered a row.

#### Scenario: Default follows the latest lap
- **WHEN** no row has been hovered yet and a new valid lap completes
- **THEN** the panel switches to analyzing the new lap

#### Scenario: Invalid lap never listed
- **WHEN** a lap completes with a cut (marked invalid)
- **THEN** it does not appear in the selection list, and the previously analyzed valid lap stays selected

#### Scenario: Hover selects and sticks
- **WHEN** the driver hovers the Lap 4 row, moves the pointer away, and later completes Lap 7
- **THEN** the panel keeps showing Lap 4

#### Scenario: Selection works without window focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over a lap row
- **THEN** that lap becomes the analyzed lap

#### Scenario: Selected lap is evicted
- **WHEN** the explicitly selected lap's recording is dropped by the store's lap cap
- **THEN** the selection falls back to the most recent complete lap

### Requirement: Hover scrub with cross-lap readout and track-map marker
Hovering the trace strips SHALL show a shared vertical cursor across all three strips with numeric readouts at that track position for both laps (speed, throttle, brake, gear, and the delta value), interpolated between bracketing samples. The scrub position SHALL be published through a shared ref so the track map draws a marker at the corresponding point on the selected lap's line while scrubbing. Scrubbing SHALL work with hover alone — no click, no keyboard, no window focus — and the cursor and marker SHALL disappear when the pointer leaves the strips.

#### Scenario: Scrubbing a corner
- **WHEN** the pointer hovers the speed strip at a position mid-corner
- **THEN** all three strips show the cursor at that position with both laps' values, and the track map marks the matching point on the selected lap's line

#### Scenario: Scrub ends
- **WHEN** the pointer leaves the trace strips
- **THEN** the cursor and the track-map marker disappear
