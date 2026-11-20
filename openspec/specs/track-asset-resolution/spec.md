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
The bridge SHALL treat `data/map.ini` (bounds metadata) and `ai/fast_lane.ai` (track edges) as independent assets: a track with only `map.ini` still yields metadata, and a track with only a valid AI spline still yields edges. A `map.ini` SHALL yield metadata only when all five values (`WIDTH`, `HEIGHT`, `X_OFFSET`, `Z_OFFSET`, `SCALE_FACTOR`) are finite numbers and `WIDTH`, `HEIGHT` and `SCALE_FACTOR` are greater than zero; any other `map.ini` SHALL be treated as absent. The bridge SHALL NOT look for or resolve the track's `map.png`.

#### Scenario: Track with map.ini but no AI spline
- **WHEN** a session starts on a track whose folder has `data/map.ini` but no usable `ai/fast_lane.ai`
- **THEN** the session message carries the parsed `meta` and `edges: null`

#### Scenario: Edges resolve independently of map metadata
- **WHEN** a track has a valid `ai/fast_lane.ai` but no `map.ini`
- **THEN** the session message carries the resolved `edges` and `meta: null`

#### Scenario: Track with neither asset
- **WHEN** neither `data/map.ini` nor a usable `ai/fast_lane.ai` exists in the track or layout folder
- **THEN** the session message has `meta: null` and `edges: null`

#### Scenario: Unusable map.ini values
- **WHEN** a track's `map.ini` has a malformed number (e.g. `1.2.3`) or a zero `WIDTH`, `HEIGHT` or `SCALE_FACTOR`
- **THEN** the session message carries `meta: null`, exactly as for a track without `map.ini`

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

### Requirement: Bridge resolves named track sections
The bridge SHALL resolve the track's named sections from `data/sections.ini`, using the same layout-aware directory order as `map.ini` (layout folder first, then track root), and SHALL treat them as an asset independent of `map.ini` and `ai/fast_lane.ai`: a track with sections but neither of the others still yields sections, and the reverse. On a multi-layout track the first `sections.ini` found SHALL be the only one considered — a layout file that yields nothing SHALL NOT fall through to the track root's, which describes another layout.

Each `[SECTION_n]` block SHALL yield one section from its `IN`, `OUT` and `TEXT` keys, whatever order the blocks and keys appear in and whatever numbers the block headers carry. The parser SHALL be garbage-tolerant in the tradition of the other content parsers: it SHALL ignore a leading byte-order mark, SHALL decode the file as UTF-8 and fall back to Windows-1252 when the bytes are not valid UTF-8, SHALL trim each name and strip control characters from it, and SHALL drop — never throw on — any block whose `IN` or `OUT` is not a finite number, that does not satisfy `0 ≤ IN < OUT ≤ 1`, or whose name is empty after cleaning.

The surviving sections SHALL be ordered by `IN`, and a section that ends no later than the section before it SHALL be dropped, so that the ordered list always advances around the lap. The result SHALL be treated as unavailable when fewer than two sections survive. A missing, unreadable or unusable `sections.ini` SHALL never raise an error and SHALL never affect the resolution of `meta` or `edges`.

#### Scenario: Stock track with sections
- **WHEN** a session starts on the Nordschleife, whose layout folder ships a `sections.ini` with 39 sections
- **THEN** the bridge resolves 39 named sections in lap order, the first named `Hatzenbachbogen`

#### Scenario: Byte-order mark before the first header
- **WHEN** the file begins with a UTF-8 byte-order mark immediately before `[SECTION_0]`
- **THEN** the first section is parsed like every other

#### Scenario: Accented names
- **WHEN** a section's `TEXT` is `Döttinger Höhe` in a UTF-8 file, or the same name in a Windows-1252 file
- **THEN** the resolved name is `Döttinger Höhe` in both cases

#### Scenario: Name with trailing whitespace
- **WHEN** a section's `TEXT` is `Schwalbenschwanz ` with a trailing space
- **THEN** the resolved name is `Schwalbenschwanz`

#### Scenario: Malformed block
- **WHEN** one block has `IN=0.5` and `OUT=0.4`, or a non-numeric `IN`, or no `TEXT`
- **THEN** that block is dropped and the remaining sections still resolve

#### Scenario: Section nested inside the previous one
- **WHEN** a section's span lies entirely within the span of the section before it
- **THEN** the nested section is dropped and the ordered list still advances around the lap

#### Scenario: Track without sections
- **WHEN** the track ships no `sections.ini`, or one from which fewer than two sections survive
- **THEN** no sections resolve, no error is raised, and `meta` and `edges` resolve exactly as they would otherwise

#### Scenario: Sections without map data
- **WHEN** a track ships a usable `sections.ini` but neither a usable `map.ini` nor a usable AI spline
- **THEN** the session still carries the sections, alongside `meta: null` and `edges: null`

#### Scenario: Layout file is unusable
- **WHEN** the loaded layout's `sections.ini` exists but yields no sections and the track root also has a `sections.ini`
- **THEN** no sections resolve rather than the track root's being used

### Requirement: Named sections travel on the session message
Every `session` message the bridge sends SHALL carry the resolved sections for that session as `sections`: an array of `{ name, in, out }` in lap order, with `in` and `out` as normalized track positions, or `null` when none resolved. The field SHALL be additive: a consumer SHALL treat a `session` message without the field — one from a bridge or a recording made before it existed — exactly as it treats `sections: null`, and the protocol version SHALL NOT change on its account.

#### Scenario: Sections available
- **WHEN** a session is active on a track with resolved sections
- **THEN** the session message's `sections` holds them in lap order

#### Scenario: Late-joining client
- **WHEN** a client connects while a session is already active
- **THEN** the `session` message in its greeting carries the same `sections` as the original broadcast

#### Scenario: Recording made before the field existed
- **WHEN** the web app replays a recording whose `session` message has no `sections` field
- **THEN** the recording is accepted and behaves as a session with no named sections

### Requirement: Bridge resolves CSP traffic lanes
The bridge SHALL resolve the track's traffic lanes from `data/traffic.json`, the lane graph written by CSP's traffic planner, using the same layout-aware directory order as `map.ini` (layout folder first, then track root), and SHALL treat them as an asset independent of `map.ini`, `ai/fast_lane.ai` and `sections.ini`. Only the first existing `traffic.json` SHALL be read: one that yields no lanes SHALL NOT fall through to the track root's, which describes another layout.

The file SHALL be parsed as JSON after dropping a leading byte-order mark. Each entry of its top-level `lanes` array SHALL yield one lane: the world `[x, z]` of each of its `points` (the first and third numbers of an `[x, y, z]` triple), in file order, rounded to centimetres, with the first point repeated at the end when the lane's `loop` is `true`. The parser SHALL be garbage-tolerant and SHALL drop, never throw on, a lane that is not an object, whose `points` is not an array, that has a point that is not an array of at least three finite numbers, or that has fewer than two points.

The lanes SHALL be unavailable when the file is not a JSON object with a `lanes` array, when no lane survives, or when `map.ini` metadata exists and fewer than 80% of all lane points project inside the map's world rectangle (10% margin), the same cross-check the AI spline passes. A missing `traffic.json` SHALL change nothing and log nothing. An unreadable, unparseable or rejected one SHALL log a warning that names the file. None of these SHALL raise an error or affect the resolution of `meta`, `edges` or `sections`.

#### Scenario: Mod track ships a traffic lane graph
- **WHEN** a session starts on SRP's `main_layout`, whose `data/traffic.json` holds 65 lanes
- **THEN** the bridge resolves 65 lanes in world coordinates alongside the layout's `map.ini` metadata

#### Scenario: Track without a traffic lane graph
- **WHEN** a session starts on a track that ships no `data/traffic.json`, as every stock track does
- **THEN** no lanes resolve, nothing about lanes is logged, and `meta`, `edges` and `sections` resolve exactly as before this capability

#### Scenario: Malformed lane
- **WHEN** one lane has a point with a non-numeric coordinate, another has a single point, and the rest are well formed
- **THEN** those two lanes are dropped and the rest resolve

#### Scenario: Looping lane
- **WHEN** a lane's `loop` is `true`
- **THEN** its polyline ends on its first point again

#### Scenario: File is not a lane graph
- **WHEN** `data/traffic.json` is not valid JSON, or is a JSON object without a `lanes` array
- **THEN** a warning names the file and no lanes resolve

#### Scenario: Lane graph copied from another track
- **WHEN** the lanes' coordinates lie outside the track's `map.ini` world rectangle
- **THEN** the bounds cross-check rejects them, a warning names the file, and no lanes resolve

#### Scenario: Layout file is unusable
- **WHEN** the loaded layout's `traffic.json` exists but yields no lanes and the track root also has one
- **THEN** no lanes resolve rather than the track root's being used

### Requirement: Traffic lanes travel on the session message
Every `session` message the bridge sends SHALL carry the resolved lanes for that session as `lanes`: an array of polylines, each an array of `[x, z]` world coordinates in metres, or `null` when none resolved. The field SHALL be additive: a consumer SHALL treat a `session` message without the field, from a bridge or a recording made before it existed, exactly as it treats `lanes: null`, and the protocol version SHALL NOT change on its account.

#### Scenario: Lanes available
- **WHEN** a session is active on a track with resolved lanes
- **THEN** the session message's `lanes` holds one polyline per lane

#### Scenario: Late-joining client
- **WHEN** a client connects while a session is already active
- **THEN** the `session` message in its greeting carries the same `lanes` as the original broadcast

#### Scenario: Recording made before the field existed
- **WHEN** the web app replays a recording whose `session` message has no `lanes` field
- **THEN** the recording is accepted and behaves as a session without lanes
