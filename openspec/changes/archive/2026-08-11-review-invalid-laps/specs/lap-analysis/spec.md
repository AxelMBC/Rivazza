## MODIFIED Requirements

### Requirement: Lap selection list
The panel SHALL list every complete recorded lap of the session — valid and invalid alike —
with lap number and recorded time, the fastest valid lap in the best-lap accent. An invalid
lap SHALL be visually marked as invalid wherever it appears (an `INV` tag beside its lap
number and its time in the critical tone), matching the session lap list's cue, so it can
never be mistaken for a target time. Selection SHALL be hover-only — hovering a row selects
that lap for analysis, and the selection persists after the pointer leaves (the last-hovered
lap stays selected); no click, keyboard, or window focus is required for any part of it. The
selection SHALL default to the most recent complete lap regardless of validity, and SHALL
follow new laps as they complete until the driver has hovered a row.

#### Scenario: Default follows the latest lap
- **WHEN** no row has been hovered yet and a new complete lap finishes
- **THEN** the panel switches to analyzing the new lap, whether it is valid or invalid

#### Scenario: Invalid lap is listed and reviewable
- **WHEN** a lap completes with a cut (marked invalid)
- **THEN** it appears in the selection list marked invalid, and hovering it analyzes that lap

#### Scenario: Invalid lap is never a target
- **WHEN** an invalid lap's raw time is the fastest of the session
- **THEN** it is shown in the critical tone and the best-lap accent stays on the fastest valid
  lap

#### Scenario: Hover selects and sticks
- **WHEN** the driver hovers the Lap 4 row, moves the pointer away, and later completes Lap 7
- **THEN** the panel keeps showing Lap 4

#### Scenario: Selection works without window focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over a lap row
- **THEN** that lap becomes the analyzed lap

#### Scenario: Selected lap is evicted
- **WHEN** the explicitly selected lap's recording is dropped by the store's lap cap
- **THEN** the selection falls back to the most recent complete lap

### Requirement: Analysis panel with distance-aligned traces
The dashboard SHALL include a lap analysis panel rendering three stacked canvas strips sharing
a normalized-track-position x-axis: speed (km/h), pedals (throttle and brake overlaid, 0–100%),
and time delta (± seconds, zero-centered). The strips SHALL plot the selected lap overlaid on
the reference lap (speed and pedals show both laps; the delta strip shows selected minus
reference). The reference lap SHALL be strictly the fastest valid, complete recorded lap of the
session — an invalid lap SHALL never serve as reference or be presented as the session best,
even when its raw time is lower. When no valid complete lap exists the selected lap SHALL
render alone and the delta strip SHALL state that there is no valid lap to compare against
rather than showing a bare zero line. Before any complete recorded lap exists the panel SHALL
show an empty state instead of blank charts. When the selected lap is invalid, the panel's
header SHALL mark it in the critical tone. Canvas rendering SHALL be dirty-gated — repaint only
when selection, reference, scrub position, recording contents, or canvas size change.

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
- **THEN** the panel lists those laps and renders the selected lap's speed and pedal traces,
  the delta strip states that no valid lap is available as a reference, and no session best is
  shown

#### Scenario: Invalid lap under analysis
- **WHEN** the selected lap is invalid and a valid reference exists
- **THEN** the header marks the selected lap in the critical tone and the delta strip still
  compares it against the valid reference

### Requirement: Panel collapsed to a bar until hovered
The analysis panel SHALL NOT occupy dashboard space by default: the track map keeps its full
area and the panel renders as a slim always-visible bar (title plus a summary such as lap count
and session best). The bar's lap count SHALL describe the full selection list, counting invalid
laps alongside valid ones. Hovering the bar SHALL pop the full panel out as an overlay floating
above the bar (over the map), which stays open while the pointer remains inside the bar or panel
and closes when the pointer leaves — no click, keyboard, or window focus at any point. The
session best shown in the bar and panel SHALL be the fastest valid lap only.

#### Scenario: Idle dashboard keeps the map dominant
- **WHEN** the pointer is elsewhere on the dashboard
- **THEN** only the slim bar is visible and the track map has its full height

#### Scenario: Hover opens, leave closes
- **WHEN** the pointer moves onto the bar and then up into the opened panel
- **THEN** the panel stays open throughout, and it closes when the pointer leaves the panel

#### Scenario: Invalid fastest lap is not the session best
- **WHEN** the raw-fastest lap is invalid and a slower valid lap exists
- **THEN** the bar and panel show the valid lap's time as session best

#### Scenario: Bar count includes invalid laps
- **WHEN** the session has three valid complete laps and one invalid complete lap
- **THEN** the bar reports four laps and a session best drawn from the valid three

## ADDED Requirements

### Requirement: Invalid lap reveals its cuts on the track map
Selecting an invalid lap in the analysis panel SHALL publish that lap through the shared
analysis-lap channel exactly as a valid selection does, so the track map reveals that lap's
driven line together with the cut markers recorded on it. The driver SHALL therefore be able
to see where a lap was invalidated by selecting it, with hover alone and no window focus.

#### Scenario: Seeing why a lap was invalidated
- **WHEN** the driver hovers the row of a lap that was invalidated by a cut
- **THEN** the track map shows that lap's line with its cut markers

#### Scenario: Selection cleared
- **WHEN** the panel closes or the pointer leaves it
- **THEN** the map stops revealing that lap's line and markers
