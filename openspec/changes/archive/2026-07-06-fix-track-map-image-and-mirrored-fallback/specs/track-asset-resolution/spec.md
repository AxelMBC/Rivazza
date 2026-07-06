# track-asset-resolution (delta)

## MODIFIED Requirements

### Requirement: Map metadata and image resolve independently
The bridge SHALL treat `data/map.ini` (bounds metadata) and `map.png` (map image) as independent assets: a track with only `map.ini` still yields bounds. `/api/track-map/meta` SHALL respond whenever metadata was found, and `/api/track-map/image` only when the image was found. Both endpoints SHALL be matched by request **pathname**: any query string (e.g. the web client's cache-busting `?v=<track>` parameter) SHALL be ignored for routing. The session message SHALL report both `mapAvailable` (image and metadata) and `boundsAvailable` (metadata, with or without image).

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
