## MODIFIED Requirements

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
