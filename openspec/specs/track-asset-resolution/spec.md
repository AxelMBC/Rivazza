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
The bridge SHALL treat `data/map.ini` (bounds metadata) and `map.png` (map image) as independent assets: a track with only `map.ini` still yields bounds. `/api/track-map/meta` SHALL respond whenever metadata was found, and `/api/track-map/image` only when the image was found. The session message SHALL report both `mapAvailable` (image and metadata) and `boundsAvailable` (metadata, with or without image).

#### Scenario: Track with map.ini but no map.png
- **WHEN** a session starts on a track whose folder has `data/map.ini` but no `map.png`
- **THEN** the session message has `boundsAvailable: true` and `mapAvailable: false`, and `/api/track-map/meta` returns the parsed metadata

#### Scenario: Track with both files
- **WHEN** both `map.png` and `data/map.ini` exist
- **THEN** `mapAvailable` and `boundsAvailable` are both true and both endpoints respond

#### Scenario: Track with neither file
- **WHEN** neither file exists in the track or layout folder
- **THEN** both flags are false and both endpoints return 404
