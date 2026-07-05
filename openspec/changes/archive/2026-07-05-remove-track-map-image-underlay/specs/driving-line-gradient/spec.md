# driving-line-gradient (delta)

## MODIFIED Requirements

### Requirement: Gradient line works in both map modes
The gradient rendering SHALL apply both when `map.ini` metadata is available (world coordinates projected through the metadata transform) and in the fallback breadcrumb mode where the outline is drawn from visited positions.

#### Scenario: Track without map assets
- **WHEN** the track has no map data and the driver completes part of a lap
- **THEN** the auto-fitted view draws the driven line with the same throttle/brake/coast coloring

#### Scenario: Track with map metadata
- **WHEN** the track has `data/map.ini` and the driver completes part of a lap
- **THEN** the metadata-projected view draws the driven line with the same throttle/brake/coast coloring
