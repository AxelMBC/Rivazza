## REMOVED Requirements

### Requirement: Map metadata and image resolve independently
**Reason**: `map.png` is no longer an asset (the web app never draws it), and the HTTP endpoints and availability flags this requirement defines are replaced by nullable fields on the session message.
**Migration**: "Map metadata and edges resolve independently" keeps the independence rule; "Track assets travel on the session message" replaces the endpoints and flags.

### Requirement: Track edges are served over HTTP
**Reason**: Edges are delivered inside the session message, so clients hold them before the first telemetry frame without a second request.
**Migration**: "Track assets travel on the session message" carries the edge format, the `pos` contract and the not-available signal unchanged in substance.

## ADDED Requirements

### Requirement: Map metadata and edges resolve independently
The bridge SHALL treat `data/map.ini` (bounds metadata) and `ai/fast_lane.ai` (track edges) as independent assets: a track with only `map.ini` still yields metadata, and a track with only a valid AI spline still yields edges. The bridge SHALL NOT look for or resolve the track's `map.png`.

#### Scenario: Track with map.ini but no AI spline
- **WHEN** a session starts on a track whose folder has `data/map.ini` but no usable `ai/fast_lane.ai`
- **THEN** the session message carries the parsed `meta` and `edges: null`

#### Scenario: Edges resolve independently of map metadata
- **WHEN** a track has a valid `ai/fast_lane.ai` but no `map.ini`
- **THEN** the session message carries the resolved `edges` and `meta: null`

#### Scenario: Track with neither asset
- **WHEN** neither `data/map.ini` nor a usable `ai/fast_lane.ai` exists in the track or layout folder
- **THEN** the session message has `meta: null` and `edges: null`

#### Scenario: Track ships a map.png
- **WHEN** the track folder contains `map.png`
- **THEN** nothing about the image appears on the wire and the session message is identical to one for the same track without it

### Requirement: Track assets travel on the session message
Every `session` message the bridge sends — the broadcast when a session starts and the copy in a newly connected client's greeting alike — SHALL carry the resolved assets for that session: `meta` as `{ width, height, xOffset, zOffset, scaleFactor }` or `null`, and `edges` as `{ closed: boolean, left: [x, z][], right: [x, z][], pos: number[] }` or `null`, with edge coordinates in world meters rounded to centimeters. A `null` field SHALL be the only signal that the asset is unavailable; the message SHALL NOT carry separate availability flags. The bridge SHALL NOT serve track assets over HTTP; its port SHALL serve only the WebSocket upgrade and SHALL answer any other request with 426 Upgrade Required.

`pos` SHALL carry the normalized track position (0–1) of each edge vertex, index-aligned one-to-one with `left` and `right`, so that consumers can locate any normalized track position on the track's own geometry without re-deriving it. It SHALL be computed as cumulative distance along the AI spline's own points, normalized by the spline's total length — closing the loop for a closed circuit — rather than read from the spline file's per-point length field, which is subject to the same corruption as every other field the parser defends against. `pos` SHALL be monotonically non-decreasing, start at 0, and be rounded to a precision finer than the map can display.

#### Scenario: Edges available
- **WHEN** a session is active on a track with resolved edges
- **THEN** the session message's `edges` holds the polylines with their positions

#### Scenario: Late-joining client
- **WHEN** a client connects while a session is already active
- **THEN** the `session` message in its greeting carries the same `meta` and `edges` as the original broadcast, with no further request needed

#### Scenario: Assets arrive before telemetry
- **WHEN** a client receives the first telemetry frame of a session
- **THEN** it has already received that session's `meta` and `edges` (or their `null`)

#### Scenario: Asset routes are gone
- **WHEN** a client requests `/api/track-map/meta`, `/api/track-map/edges` or `/api/track-map/image`
- **THEN** the bridge responds 426 and the WebSocket keeps serving normally

#### Scenario: Positions align with the polylines
- **WHEN** edges are present
- **THEN** `pos`, `left` and `right` have identical lengths and index *i* of each describes the same point on the track

#### Scenario: Position runs from the start line
- **WHEN** edges are present for a closed circuit
- **THEN** `pos[0]` is 0 at the start/finish line and the values increase monotonically around the lap
