## ADDED Requirements

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

## MODIFIED Requirements

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
