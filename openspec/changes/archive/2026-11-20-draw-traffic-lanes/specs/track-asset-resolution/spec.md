## ADDED Requirements

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
