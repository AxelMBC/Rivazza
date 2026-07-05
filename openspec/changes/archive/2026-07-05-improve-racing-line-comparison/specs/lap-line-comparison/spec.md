# lap-line-comparison

## ADDED Requirements

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
When the cursor hovers within the pick radius of stored lap lines, the hover readout SHALL list, for every colored lap with a sample inside that radius, the lap's number (with its color) and its speed at the nearest sample, rounded to whole km/h. The nearest lap overall SHALL additionally keep the existing "Lap N — time" identification (time red when invalid, number-only when unrecorded). The readout SHALL work with hover alone — no click or focus — and SHALL follow the existing hover-label placement behavior.

#### Scenario: Comparing corner speeds across lines
- **WHEN** three colored laps pass through a hovered corner within the pick radius
- **THEN** the readout lists all three laps with their speed at that point, and the nearest one also shows its lap time

#### Scenario: Hovering an isolated line at high zoom
- **WHEN** the view is zoomed so only one lap's line is within the pick radius of the cursor
- **THEN** the readout shows only that lap's row

#### Scenario: Hovering a grey (uncolored) lap
- **WHEN** the nearest line belongs to a lap outside the colored set
- **THEN** the existing "Lap N — time" label still appears for it

### Requirement: Hover highlight keeps the lap's identity color
Hovering a stored lap line SHALL emphasize that lap by increasing its stroke width and opacity rather than re-coloring it, so a colored lap remains identifiable while highlighted. Grey laps SHALL brighten with the same emphasis treatment.

#### Scenario: Highlighting a colored lap
- **WHEN** the cursor hovers a palette-colored lap line
- **THEN** the line thickens and renders at full opacity in its own palette color, not a separate highlight color
