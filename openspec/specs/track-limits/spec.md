# track-limits

## Purpose
Defines how the track map depicts real track limits, sourced from the AI spline's
per-point edge measurements (resolution and serving of that data are owned by the
`track-asset-resolution` capability).

## Requirements

### Requirement: Track map renders the track surface beneath driving lines
When edge data is available, the track map SHALL draw the track surface under all
driving lines: a filled ribbon between the left and right edge polylines in a muted
surface tone, plus subtle edge strokes marking the track limits. The ribbon SHALL be
rendered through a cached offscreen layer keyed on the projection, preserving the
dirty-gated render loop — the ribbon repaints only when the projection (zoom, resize,
DPR) changes. Driving-line colors, hover picking, the legend, and the car dot SHALL
render above the ribbon unchanged. When no edge data is available the map SHALL render
exactly as before this capability.

#### Scenario: Ribbon under the lines
- **WHEN** driving on a track with resolved edges
- **THEN** the pedal-colored current lap and stored lap lines draw on top of a filled track ribbon whose edges mark the real track limits

#### Scenario: Zooming re-projects the ribbon
- **WHEN** the user scroll-zooms the map
- **THEN** the ribbon re-renders at the new projection and stays exactly registered with the driven lines

#### Scenario: Idle map stays idle
- **WHEN** telemetry, mouse, zoom, and canvas size are all unchanged
- **THEN** the presence of the ribbon causes no additional repaints
