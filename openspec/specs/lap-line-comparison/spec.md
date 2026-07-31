# lap-line-comparison

## Purpose
TBD - created by syncing change improve-racing-line-comparison. Update Purpose after review.

## Requirements

### Requirement: Recent completed laps render in distinct stable colors
The track map SHALL render the most recent 6 completed laps each in a distinct color from a fixed palette, assigned by lap number (`lap % palette size`) so a lap's color never changes for the life of the session as further laps complete. Completed laps older than the colored set SHALL render in the existing faint grey. The palette SHALL avoid the green, red, and yellow hues reserved for the current lap's pedal gradient. The current (in-progress) lap SHALL keep its pedal-gradient coloring unchanged.

#### Scenario: Three-lap comparison session
- **WHEN** a driver completes three laps taking different lines through the corners
- **THEN** the map shows three lines in three distinct colors, visually separable at zoom

#### Scenario: Colors are stable as laps accumulate
- **WHEN** lap 7 completes while laps 2–6 are on the map
- **THEN** laps 2–6 keep the exact colors they already had and lap 7 gains its own

#### Scenario: Old laps fall back to grey
- **WHEN** more than 6 laps have completed
- **THEN** only the 6 most recent render in palette colors and all earlier laps render grey

### Requirement: On-map legend identifies colored laps
While at least one colored lap exists, the map panel SHALL show a legend listing each currently-colored lap: its color swatch, lap number, and recorded lap time from the session lap log (rendered in the critical/red color when the lap is invalid), ordered most recent first. Laps without a lap-log record (driven before the page connected) SHALL show their number without a time. The legend SHALL be purely informational and require no interaction of any kind.

#### Scenario: Legend after three laps
- **WHEN** laps 1–3 have completed with recorded times
- **THEN** the legend shows three swatch + "Lap N" + time rows matching the line colors, lap 3 first

#### Scenario: Invalid lap in the legend
- **WHEN** a colored lap's record is marked invalid
- **THEN** its time renders in the critical/red color

### Requirement: Lap samples record speed
Each stored lap-line sample SHALL additionally record the car's speed (`speedKmh`) from the telemetry frame that produced it, taken raw (no smoothing or interpolation), for both the current lap and all stored completed laps.

#### Scenario: Sample carries frame speed
- **WHEN** a sample is appended while the frame reports 143.2 km/h
- **THEN** that sample stores 143.2 km/h

### Requirement: Hover shows per-lap speed at the hovered point
When the cursor hovers within the pick radius of stored lap lines, the hover readout SHALL list, for every colored lap with a sample inside that radius, the lap's number (with its color), its speed at the nearest sample rounded to whole km/h, its gear at that sample, and a compact indication of its pedal state there (throttle/brake/coasting). The nearest lap overall SHALL additionally keep the existing "Lap N — time" identification (time red when invalid, number-only when unrecorded). The readout SHALL work with hover alone — no click or focus — and SHALL follow the existing hover-label placement behavior.

#### Scenario: Comparing corner speeds across lines
- **WHEN** three colored laps pass through a hovered corner within the pick radius
- **THEN** the readout lists all three laps with their speed, gear, and pedal state at that point, and the nearest one also shows its lap time

#### Scenario: Hovering an isolated line at high zoom
- **WHEN** the view is zoomed so only one lap's line is within the pick radius of the cursor
- **THEN** the readout shows only that lap's row

#### Scenario: Hovering a grey (uncolored) lap
- **WHEN** the nearest line belongs to a lap outside the colored set
- **THEN** the existing "Lap N — time" label still appears for it

#### Scenario: Distinguishing pedal states at a braking point
- **WHEN** at the hovered point one colored lap's nearest sample is braking and another's is on throttle
- **THEN** the two rows show visibly different pedal-state indications

### Requirement: Hover highlight keeps the lap's identity color
Hovering a stored lap line SHALL emphasize that lap by increasing its stroke width and opacity rather than re-coloring it, so a colored lap remains identifiable while highlighted. Grey laps SHALL brighten with the same emphasis treatment.

#### Scenario: Highlighting a colored lap
- **WHEN** the cursor hovers a palette-colored lap line
- **THEN** the line thickens and renders at full opacity in its own palette color, not a separate highlight color

### Requirement: Focused lap renders in front with its markers
Whatever surface focuses a lap — its line hovered on the map, its row hovered in the session-lap list, or the analysis panel's selection while that panel is open — the treatment SHALL be identical: the lap's line renders on top of all other lap lines with the emphasis stroke, and its cut markers and braking ticks reveal. A lap being inspected is never buried under later laps. While the follow camera is driving the view, the map-hover focus source SHALL be suspended; the session-lap-list and analysis-panel focus sources SHALL keep working unchanged.

#### Scenario: Session-list hover brings the line to the front
- **WHEN** Lap 1's row is hovered in the session-lap list while Lap 2's line overlaps Lap 1's on the map
- **THEN** Lap 1's line draws in front of Lap 2's, emphasized, with its brake ticks and cut markers visible

#### Scenario: Analysis selection brings the line to the front
- **WHEN** the analysis panel is open with a lap selected
- **THEN** that lap's line renders in front with the emphasis stroke

#### Scenario: Map hover is not a focus source while following
- **WHEN** the view is following the car and the cursor rests on a stored lap's line
- **THEN** no lap is focused by that hover, and no brake ticks or cut markers reveal from it

### Requirement: Braking-point markers revealed for the focused lap
For each completed lap, the track map SHALL compute the points where braking began — a brake application onset detected with hysteresis and a minimum no-braking distance gate so trail-braking flutter does not spawn spurious markers — once per completed lap, cached. Markers SHALL never render ambiently (all laps' ticks at once are visual noise): they render as small ticks in the lap's identity color only for the single focused lap, where focus means any of: the lap's line hovered on the map, the lap's row hovered in the session-lap list, or the lap selected in the analysis panel while that panel is open. When no lap is focused, no ticks render. The in-progress lap SHALL NOT show markers (its live pedal gradient already shows braking).

#### Scenario: No focus, no ticks
- **WHEN** the pointer is not on any lap line, lap-list row, or open analysis panel
- **THEN** the map shows no braking ticks

#### Scenario: Hovering a lap line reveals only that lap's ticks
- **WHEN** the cursor hovers Lap 4's line on the map while Laps 3–5 are stored
- **THEN** only Lap 4's braking ticks render, in Lap 4's identity color

#### Scenario: Analysis selection reveals ticks while the panel is open
- **WHEN** the analysis panel is open with Lap 3 selected
- **THEN** Lap 3's braking ticks render on the map, and disappear when the panel closes

#### Scenario: Trail-brake flutter suppressed
- **WHEN** a lap's brake trace crosses the onset threshold multiple times within the no-braking distance gate
- **THEN** only one marker is produced for that braking zone

### Requirement: Cursor picking is suspended while the follow camera drives the view
The cursor SHALL NOT pick stored lap lines while the follow camera is driving the view (tracking the car, or animating back out of follow mode): no hover readout, no line-hover ring, no hover emphasis, no brake ticks or cut markers revealed by the cursor, and no pointer cursor. This takes precedence over the hover-driven requirements in this capability for as long as follow mode is driving the view. The reason is that the map sweeps under a parked cursor in follow mode, so lines pick themselves as the car drives past them, and with more than one stored lap the readout, ring and emphasis change on every frame — noise rather than analysis. Deliberate, named selections SHALL continue to reveal exactly as they do outside follow mode: the analysis panel's selection and scrub, and the session-lap-list row hover. Inspecting a lap while following is done through those surfaces. Leaving follow mode SHALL restore cursor picking with no further action.

#### Scenario: Cursor parked on a line while following
- **WHEN** the view is tracking the car and the cursor rests where stored lap lines pass under it
- **THEN** no readout, ring, or emphasis appears and the cursor does not become a pointer

#### Scenario: Several stored laps under a moving map
- **WHEN** more than one stored lap is on the map and the car drives past their lines in follow mode
- **THEN** the map shows no hover response at all, rather than a readout that changes every frame

#### Scenario: Analysis panel still reveals while following
- **WHEN** a lap is selected in the analysis panel (or its trace is scrubbed) while the view is following
- **THEN** that lap renders in front with its emphasis, markers, and scrub ring exactly as outside follow mode

#### Scenario: Session-lap-list hover still reveals while following
- **WHEN** a lap's row is hovered in the session-lap list while the view is following
- **THEN** that lap's line is emphasized on the map with its markers

#### Scenario: Leaving follow restores picking
- **WHEN** the user exits follow mode and hovers a stored lap line
- **THEN** the readout, ring, and emphasis behave exactly as before follow mode was entered
