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

### Requirement: Map metadata and image resolve independently
The bridge SHALL treat `data/map.ini` (bounds metadata), `map.png` (map image), and `ai/fast_lane.ai` (track edges) as independent assets: a track with only `map.ini` still yields bounds, and a track with only a valid AI spline still yields edges. `/api/track-map/meta` SHALL respond whenever metadata was found, `/api/track-map/image` only when the image was found, and `/api/track-map/edges` only when edges resolved. All three endpoints SHALL be matched by request **pathname**: any query string (e.g. the web client's cache-busting `?v=<track>` parameter) SHALL be ignored for routing. The session message SHALL report `mapAvailable` (image and metadata), `boundsAvailable` (metadata, with or without image), and `edgesAvailable` (edges resolved).

#### Scenario: Track with map.ini but no map.png
- **WHEN** a session starts on a track whose folder has `data/map.ini` but no `map.png`
- **THEN** the session message has `boundsAvailable: true` and `mapAvailable: false`, and `/api/track-map/meta` returns the parsed metadata

#### Scenario: Track with both files
- **WHEN** both `map.png` and `data/map.ini` exist
- **THEN** `mapAvailable` and `boundsAvailable` are both true and both endpoints respond

#### Scenario: Track with neither file
- **WHEN** neither file exists in the track or layout folder
- **THEN** both flags are false and both endpoints return 404

#### Scenario: Image request carries a cache-busting query string
- **WHEN** the track has a `map.png` and a client requests `/api/track-map/image?v=imola%2F`
- **THEN** the bridge responds 200 with the PNG bytes, exactly as it does for `/api/track-map/image` with no query string

#### Scenario: Edges resolve independently of map assets
- **WHEN** a track has a valid `ai/fast_lane.ai` but no `map.ini` and no `map.png`
- **THEN** `edgesAvailable` is true and `/api/track-map/edges` responds while the other two endpoints return 404

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

### Requirement: Track edges are served over HTTP
The bridge SHALL serve resolved edges at `/api/track-map/edges` as JSON `{ closed: boolean, left: [x, z][], right: [x, z][] }` with coordinates in world meters rounded to centimeters, and SHALL respond 404 when no edges resolved. The session message SHALL report `edgesAvailable` accordingly.

#### Scenario: Edges available
- **WHEN** a session is active on a track with resolved edges
- **THEN** `/api/track-map/edges` returns the polylines and the session message has `edgesAvailable: true`

#### Scenario: Edges unavailable
- **WHEN** no session is active or the track yielded no edges
- **THEN** `/api/track-map/edges` returns 404 and `edgesAvailable` is false
