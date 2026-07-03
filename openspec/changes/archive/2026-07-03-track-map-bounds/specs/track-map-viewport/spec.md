# track-map-viewport

## ADDED Requirements

### Requirement: Real track bounds fix the viewport from the first frame
Whenever `map.ini` metadata is available (`boundsAvailable`), the track map SHALL project world coordinates through the metadata transform (offsets, scale factor, pixel dimensions) — exactly as map-image mode does — even when no map image exists. The resulting viewport SHALL be fully determined before the first telemetry frame and SHALL NOT pan, zoom, or re-fit at any point: the first-lap line draws at the same position and scale it will have on every later lap.

#### Scenario: Bounds without image on first load
- **WHEN** the page loads mid-first-lap on a track with `boundsAvailable: true` and `mapAvailable: false`
- **THEN** the driving line renders inside a fixed, correctly scaled viewport identical in framing to the view after the lap completes

#### Scenario: No camera movement during lap one
- **WHEN** the driver completes their first lap with bounds-only rendering
- **THEN** at no point does the drawn line shift, rescale, or recenter — the line only extends

### Requirement: Heuristic camera only without bounds data
The anchored, zoomed-out heuristic camera SHALL be used only when no `map.ini` metadata exists for the track (e.g. mod tracks without map data), and the on-canvas note SHALL distinguish this case (drawing blind) from the bounds-known case (map image missing but scale known).

#### Scenario: Mod track without any map data
- **WHEN** a session starts on a track with neither `map.png` nor `map.ini`
- **THEN** the fallback anchored camera behavior applies, as today
