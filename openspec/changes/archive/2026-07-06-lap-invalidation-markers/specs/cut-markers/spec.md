# cut-markers (delta)

## ADDED Requirements

### Requirement: Track map marks cut locations
The track map SHALL draw a distinct marker (an × cross in the critical/red tone over a
dark halo for contrast) at each cut event's world position, projected through the same
projection as the driving lines — above the track ribbon and lap lines, below the car
dot and hover readout. Markers SHALL keep a constant screen size at every zoom level
and stay anchored to their world position while zooming or panning.

#### Scenario: Cut appears where it happened
- **WHEN** a cut event arrives while driving
- **THEN** a marker appears at the cut's world position on the map within a frame

#### Scenario: Zooming keeps markers registered
- **WHEN** the user scroll-zooms the map
- **THEN** each marker stays anchored to its world position at unchanged screen size

### Requirement: Markers associate with laps and reveal on demand
Cut markers SHALL attach to laps by the event's lap counter (existing display
convention: lapCount N is "Lap N+1"), including a cut that arrives just after its lap
completed. Only the in-progress lap's markers SHALL be ambiently visible — they leave
the ambient view the moment the lap completes. A stored lap's markers SHALL render
only while that lap is hovered: either its line on the track map, or its row in the
Lap tile's session-lap list. Markers SHALL be dropped together with their lap when it
rolls out of the bounded lap history.

#### Scenario: Lap completes with its cuts
- **WHEN** a lap with two cut markers completes
- **THEN** both markers leave the ambient map view and remain attached to the stored lap, available on hover

#### Scenario: Hovering a stored lap's line
- **WHEN** any stored lap's line is hovered on the map
- **THEN** its cut markers render while the hover emphasis lasts and hide when the pointer leaves

#### Scenario: Hovering a session-list row
- **WHEN** the pointer hovers a lap's row in the Lap tile's session-lap list
- **THEN** that lap's cut markers render on the track map until the pointer leaves the row

### Requirement: Cut markers reset with the session
Cut markers SHALL clear when the session changes and when a session restart is detected
(the existing lap-counter/lap-clock signature). A cut event whose lap counter matches
neither the current lap nor a stored lap (e.g. a pre-restart leftover) SHALL never be
attached or drawn.

#### Scenario: Session restart clears markers
- **WHEN** the driver restarts the session
- **THEN** all markers disappear along with the driven lines

#### Scenario: Stale event dropped
- **WHEN** a cut event references a lap counter that matches neither the current nor any stored lap
- **THEN** it is discarded without drawing

### Requirement: Markers preserve the dirty-gated render loop
Cut marker support SHALL keep the map's dirty-gated rAF loop intact: the arrival of a
cut event triggers a repaint, and an idle map (no telemetry, mouse, zoom, size, or cut
changes) SHALL keep skipping repaints exactly as before.

#### Scenario: Idle map stays idle
- **WHEN** telemetry, mouse, zoom, canvas size, and the cut list are all unchanged
- **THEN** marker support causes no additional repaints
