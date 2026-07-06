# track-limits

## ADDED Requirements

### Requirement: Bridge resolves track edges from the AI spline
The bridge SHALL resolve track-edge polylines from `ai/fast_lane.ai`, using the same
layout-aware directory order as `map.ini` (layout folder first, then track root). The
parser SHALL validate the binary structure (version 7, point count, extra-record count
equal to point count, sufficient file size) and SHALL compute, for each spline point
with unit travel direction `d = (dx, dz)` in world XZ, the left edge at
`p + (dz, −dx) · sideLeft` and the right edge at `p − (dz, −dx) · sideRight`. Side
distances SHALL be clamped to [0, 50] m and median-filtered (window 3) to remove
isolated spikes. The result SHALL be rejected — yielding no edges, never an error —
when fewer than 50 points parse, when fewer than 70% of points have positive total
width, or when `map.ini` metadata exists and fewer than 80% of spline points project
inside the map's world rectangle (10% margin): an AI file copied from a different
track must not render. The spline SHALL be marked closed when its endpoints are within
30 m, and open otherwise.

#### Scenario: Stock track with valid AI spline
- **WHEN** a session starts on a stock track (e.g. magione) whose `ai/fast_lane.ai` is valid
- **THEN** the bridge resolves left and right edge polylines forming a closed ribbon of plausible width

#### Scenario: Stub AI file
- **WHEN** the track ships a placeholder `fast_lane.ai` only a few bytes long (e.g. the `drift` playground)
- **THEN** no edges resolve and everything else behaves exactly as before this capability

#### Scenario: AI file copied from another track
- **WHEN** a mod track ships a `fast_lane.ai` whose coordinates lie outside the track's `map.ini` world rectangle
- **THEN** the bounds cross-check rejects it and no edges are served

#### Scenario: Open spline on a point-to-point track
- **WHEN** the track is a hillclimb whose spline endpoints are far apart
- **THEN** the edges resolve with `closed: false` and no closing segment is implied

### Requirement: Track edges are served over HTTP
The bridge SHALL serve resolved edges at `/api/track-map/edges` as JSON
`{ closed: boolean, left: [x, z][], right: [x, z][] }` with coordinates in world
meters rounded to centimeters, and SHALL respond 404 when no edges resolved. The
session message SHALL report `edgesAvailable` accordingly.

#### Scenario: Edges available
- **WHEN** a session is active on a track with resolved edges
- **THEN** `/api/track-map/edges` returns the polylines and the session message has `edgesAvailable: true`

#### Scenario: Edges unavailable
- **WHEN** no session is active or the track yielded no edges
- **THEN** `/api/track-map/edges` returns 404 and `edgesAvailable` is false

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
