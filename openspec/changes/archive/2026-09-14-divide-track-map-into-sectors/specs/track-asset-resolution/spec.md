## MODIFIED Requirements

### Requirement: Track edges are served over HTTP
The bridge SHALL serve resolved edges at `/api/track-map/edges` as JSON `{ closed: boolean, left: [x, z][], right: [x, z][], pos: number[] }` with coordinates in world meters rounded to centimeters, and SHALL respond 404 when no edges resolved. The session message SHALL report `edgesAvailable` accordingly.

`pos` SHALL carry the normalized track position (0–1) of each edge vertex, index-aligned one-to-one with `left` and `right`, so that consumers can locate any normalized track position on the track's own geometry without re-deriving it. It SHALL be computed as cumulative distance along the AI spline's own points, normalized by the spline's total length — closing the loop for a closed circuit — rather than read from the spline file's per-point length field, which is subject to the same corruption as every other field the parser defends against. `pos` SHALL be monotonically non-decreasing, start at 0, and be rounded to a precision finer than the map can display.

#### Scenario: Edges available
- **WHEN** a session is active on a track with resolved edges
- **THEN** `/api/track-map/edges` returns the polylines with their positions and the session message has `edgesAvailable: true`

#### Scenario: Edges unavailable
- **WHEN** no session is active or the track yielded no edges
- **THEN** `/api/track-map/edges` returns 404 and `edgesAvailable` is false

#### Scenario: Positions align with the polylines
- **WHEN** edges are served
- **THEN** `pos`, `left` and `right` have identical lengths and index *i* of each describes the same point on the track

#### Scenario: Position runs from the start line
- **WHEN** edges are served for a closed circuit
- **THEN** `pos[0]` is 0 at the start/finish line and the values increase monotonically around the lap
