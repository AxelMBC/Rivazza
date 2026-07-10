# lap-line-comparison (delta)

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Focused lap renders in front with its markers
Whatever surface focuses a lap — its line hovered on the map, its row hovered in the session-lap list, or the analysis panel's selection while that panel is open — the treatment SHALL be identical: the lap's line renders on top of all other lap lines with the emphasis stroke, and its cut markers and braking ticks reveal. A lap being inspected is never buried under later laps.

#### Scenario: Session-list hover brings the line to the front
- **WHEN** Lap 1's row is hovered in the session-lap list while Lap 2's line overlaps Lap 1's on the map
- **THEN** Lap 1's line draws in front of Lap 2's, emphasized, with its brake ticks and cut markers visible

#### Scenario: Analysis selection brings the line to the front
- **WHEN** the analysis panel is open with a lap selected
- **THEN** that lap's line renders in front with the emphasis stroke

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
