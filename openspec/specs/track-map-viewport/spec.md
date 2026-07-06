# track-map-viewport

## Purpose
TBD - created by syncing change track-map-bounds. Update Purpose after review.

## Requirements

### Requirement: Real track bounds fix the viewport from the first frame
Whenever `map.ini` metadata is available (`boundsAvailable`), the track map SHALL project world coordinates through the metadata transform (offsets, scale factor, pixel dimensions). The track map SHALL NOT render the track's `map.png` image: AC draws that image as a constant-width stroke around the AI line, which misrepresents track limits. The track surface is depicted by the track-limits ribbon (per the `track-limits` capability) when edge data resolves, with the driven lines drawn above it; without edge data the driven lines remain the only track depiction. The metadata is used solely for projection and framing. The resulting viewport SHALL be fully determined before the first telemetry frame and SHALL NOT pan, zoom, or re-fit **automatically** at any point: absent user input, the first-lap line draws at the same position and scale it will have on every later lap. User-initiated scroll-wheel zoom (per the `track-map-zoom` capability) MAY magnify this viewport; at 1× zoom the framing is exactly the fixed fit described here.

#### Scenario: Bounds on first load
- **WHEN** the page loads mid-first-lap on a track with `boundsAvailable: true`
- **THEN** the driving line renders inside a fixed, correctly scaled viewport identical in framing to the view after the lap completes

#### Scenario: No camera movement during lap one
- **WHEN** the driver completes their first lap with bounds-known rendering and does not touch the mouse wheel
- **THEN** at no point does the drawn line shift, rescale, or recenter — the line only extends

#### Scenario: User zoom is the only camera movement
- **WHEN** the user scroll-zooms during a lap and later returns to 1×
- **THEN** the view changes only in direct response to the wheel input and lands back on the fixed fit framing

#### Scenario: Track ships a map.png
- **WHEN** a session starts on a track whose folder contains both `data/map.ini` and `map.png`
- **THEN** the map image is not fetched or drawn; only the track-limits ribbon (if edges resolved), the metadata-projected driven lines, and the car dot appear

### Requirement: Heuristic camera only without bounds data
The anchored, zoomed-out heuristic camera SHALL be used only when neither `map.ini` metadata nor track-edge data exists for the track, and the on-canvas note SHALL distinguish this case (drawing blind) from the bounds-known case (map metadata missing but scale known). The heuristic camera's projection SHALL use the same world-to-screen handedness as the `map.ini` transform — world +Z maps down-screen — so the driven line is never mirrored relative to the other rendering modes and turn direction on the map always matches turn direction in the car.

#### Scenario: Mod track without any map data
- **WHEN** a session starts on a track with no `map.png`, no `map.ini`, and no usable `ai/fast_lane.ai`
- **THEN** the fallback anchored camera behavior applies, as today

#### Scenario: Turn handedness matches across modes
- **WHEN** the driver takes a left-hand corner on a track with no map data (heuristic camera)
- **THEN** the drawn line curves in the same screen direction it would on a track rendered through the `map.ini` transform — a left in the car is the same-handed curve on screen in both modes

### Requirement: Edge bounds fix the viewport when map metadata is absent
When track-edge data resolves but no `map.ini` metadata exists, the track map SHALL derive a fixed viewport from the edge polylines' world bounds plus margin. This viewport SHALL carry the same guarantee as the metadata-fixed viewport: fully determined before the first telemetry frame, and never panning, zooming, or re-fitting automatically.

#### Scenario: Mod track with AI spline but no map.ini
- **WHEN** a session starts on a track that has a usable `ai/fast_lane.ai` but no `data/map.ini`
- **THEN** the ribbon and driving lines render inside a fixed viewport fitted to the track edges, with no automatic camera movement at any point
