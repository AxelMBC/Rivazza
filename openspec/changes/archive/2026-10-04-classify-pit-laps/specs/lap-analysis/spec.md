## MODIFIED Requirements

### Requirement: Analysis panel with distance-aligned traces
The dashboard SHALL include a lap analysis panel rendering four stacked canvas strips sharing a normalized-track-position x-axis: speed (km/h), pedals (throttle and brake overlaid, 0–100%), time delta (± seconds, zero-centered), and the mini-sector ownership ribbon. All four SHALL be projected from a single shared horizontal mapping so that a given normalized track position falls at the same x in every strip. The three trace strips SHALL plot the selected lap overlaid on the reference lap (speed and pedals show both laps; the delta strip shows selected minus reference). The reference lap SHALL be strictly the fastest valid, complete recorded lap of the session — an invalid lap or a pit lap SHALL never serve as reference or be presented as the session best, even when its raw time is lower. When no valid complete lap exists the selected lap SHALL render alone and the delta strip SHALL state that there is no valid lap to compare against rather than showing a bare zero line. Before any complete recorded lap exists the panel SHALL show an empty state instead of blank charts. When the selected lap is invalid, the panel's header SHALL mark it in the critical tone; when it is a pit lap, the header SHALL name it with its `OUT` or `IN` tag in the secondary text tone. The ribbon strip SHALL keep a fixed thickness independent of panel height, with the three trace strips absorbing the remaining height at fixed proportions. Canvas rendering SHALL be dirty-gated — repaint only when selection, reference, scrub position, recording contents, or canvas size change — and the ribbon's colors, which depend only on the recordings, SHALL live in the cached trace layer so that a scrub frame remains a blit plus an overlay. Because a lap's status can reach the lap log a few frames after its recording is stored, the ribbon's cache key and the sector tables track lap status directly rather than only the recordings' version.

#### Scenario: Comparing a lap against the session best
- **WHEN** a valid complete lap exists and the driver selects another complete lap
- **THEN** the speed and pedal strips show both laps' traces aligned by track position and the delta strip shows where the selected lap gained and lost time

#### Scenario: No complete laps yet
- **WHEN** the session has no complete recorded lap
- **THEN** the panel shows an empty-state message instead of empty axes

#### Scenario: Selected lap equals the reference
- **WHEN** the selected lap is the reference lap itself
- **THEN** the strips render the single lap and the delta strip renders flat zero

#### Scenario: No valid laps exist
- **WHEN** every complete recorded lap is invalid or a pit lap
- **THEN** the panel lists those laps and renders the selected lap's speed and pedal traces, the delta strip states that no valid lap is available as a reference, and no session best is shown

#### Scenario: Invalid lap under analysis
- **WHEN** the selected lap is invalid and a valid reference exists
- **THEN** the header marks the selected lap in the critical tone and the delta strip still compares it against the valid reference

#### Scenario: Out-lap under analysis
- **WHEN** the selected lap is an `out` lap
- **THEN** the header names it with an `OUT` tag in the secondary text tone and nothing in the critical tone

#### Scenario: Ribbon thickness is stable
- **WHEN** the panel is rendered at its smaller and larger height breakpoints
- **THEN** the ribbon has the same thickness in both and only the trace strips grow

#### Scenario: Scrubbing does not rebuild the traces
- **WHEN** the pointer moves across the plotting area without the selection, reference, recordings or canvas size changing
- **THEN** the cached trace layer including the ribbon is reused and only the cursor, band and readout are redrawn

### Requirement: Lap selection list
The panel SHALL list every complete recorded lap of the session — valid, invalid and pit laps alike — with lap number and recorded time, the fastest valid lap in the best-lap accent. An invalid lap SHALL be visually marked as invalid wherever it appears (an `INV` tag beside its lap number and its time in the critical tone), matching the session lap list's cue, so it can never be mistaken for a target time. A pit lap SHALL carry an `OUT` or `IN` tag beside its lap number, with the tag and its time in the secondary text tone, matching the session lap list's cue. Selection SHALL be hover-only — hovering a row selects that lap for analysis, and the selection persists after the pointer leaves (the last-hovered lap stays selected); no click, keyboard, or window focus is required for any part of it. The selection SHALL default to the most recent complete lap regardless of status, and SHALL follow new laps as they complete until the driver has hovered a row.

#### Scenario: Default follows the latest lap
- **WHEN** no row has been hovered yet and a new complete lap finishes
- **THEN** the panel switches to analyzing the new lap, whether it is valid, invalid or a pit lap

#### Scenario: Invalid lap is listed and reviewable
- **WHEN** a lap completes with a cut (marked invalid)
- **THEN** it appears in the selection list marked invalid, and hovering it analyzes that lap

#### Scenario: Pit lap is listed and reviewable
- **WHEN** a complete `out` lap is recorded
- **THEN** it appears in the selection list with an `OUT` tag in the secondary text tone, and hovering it analyzes that lap

#### Scenario: Invalid lap is never a target
- **WHEN** an invalid lap's raw time is the fastest of the session
- **THEN** it is shown in the critical tone and the best-lap accent stays on the fastest valid lap

#### Scenario: Hover selects and sticks
- **WHEN** the driver hovers the Lap 4 row, moves the pointer away, and later completes Lap 7
- **THEN** the panel keeps showing Lap 4

#### Scenario: Selection works without window focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over a lap row
- **THEN** that lap becomes the analyzed lap
