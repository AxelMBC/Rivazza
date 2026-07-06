# track-asset-resolution

## MODIFIED Requirements

### Requirement: Map metadata and image resolve independently
The bridge SHALL treat `data/map.ini` (bounds metadata), `map.png` (map image), and
`ai/fast_lane.ai` (track edges) as independent assets: a track with only `map.ini`
still yields bounds, and a track with only a valid AI spline still yields edges.
`/api/track-map/meta` SHALL respond whenever metadata was found, `/api/track-map/image`
only when the image was found, and `/api/track-map/edges` only when edges resolved.
The session message SHALL report `mapAvailable` (image and metadata), `boundsAvailable`
(metadata, with or without image), and `edgesAvailable` (edges resolved).

#### Scenario: Track with map.ini but no map.png
- **WHEN** a session starts on a track whose folder has `data/map.ini` but no `map.png`
- **THEN** the session message has `boundsAvailable: true` and `mapAvailable: false`, and `/api/track-map/meta` returns the parsed metadata

#### Scenario: Track with both files
- **WHEN** both `map.png` and `data/map.ini` exist
- **THEN** `mapAvailable` and `boundsAvailable` are both true and both endpoints respond

#### Scenario: Track with neither file
- **WHEN** neither file exists in the track or layout folder
- **THEN** both flags are false and both endpoints return 404

#### Scenario: Edges resolve independently of map assets
- **WHEN** a track has a valid `ai/fast_lane.ai` but no `map.ini` and no `map.png`
- **THEN** `edgesAvailable` is true and `/api/track-map/edges` responds while the other two endpoints return 404
