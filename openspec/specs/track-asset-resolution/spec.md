# track-asset-resolution

## Purpose
TBD - created by syncing change track-map-bounds. Update Purpose after review.

## Requirements

### Requirement: Bridge locates the AC install beyond the default path
The bridge SHALL resolve the Assetto Corsa install directory in this order: the `AC_PATH` environment variable if set; otherwise each Steam library listed in `libraryfolders.vdf` (checked under the default Steam locations, e.g. `C:\Program Files (x86)\Steam\config\libraryfolders.vdf`) containing `steamapps/common/assettocorsa`; otherwise the default hard-coded path. The resolved path (or a warning that none was found) SHALL be logged at startup.

#### Scenario: AC installed in a secondary Steam library
- **WHEN** AC lives in `D:\SteamLibrary\steamapps\common\assettocorsa` and `libraryfolders.vdf` lists `D:\SteamLibrary`
- **THEN** the bridge resolves track assets from that directory without any configuration

#### Scenario: Explicit override wins
- **WHEN** `AC_PATH` is set
- **THEN** it is used as-is and no Steam discovery runs

### Requirement: Bridge resolves track edges from the AI spline
The bridge SHALL resolve track-edge polylines from `ai/fast_lane.ai`, using the same layout-aware directory order as `map.ini` (layout folder first, then track root). The parser SHALL validate the binary structure (version 7, point count, extra-record count equal to point count, sufficient file size) and SHALL compute, for each spline point with unit travel direction `d = (dx, dz)` in world XZ, the left edge at `p + (dz, −dx) · sideLeft` and the right edge at `p − (dz, −dx) · sideRight`. Side distances SHALL be clamped to [0, 50] m and median-filtered (window 3) to remove isolated spikes. The result SHALL be rejected — yielding no edges, never an error — when fewer than 50 points parse, when fewer than 70% of points have positive total width, or when `map.ini` metadata exists and fewer than 80% of spline points project inside the map's world rectangle (10% margin): an AI file copied from a different track must not render. The spline SHALL be marked closed when its endpoints are within 30 m, and open otherwise.

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
