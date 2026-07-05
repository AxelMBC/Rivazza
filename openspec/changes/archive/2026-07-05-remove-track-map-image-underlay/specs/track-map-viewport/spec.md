# track-map-viewport (delta)

## MODIFIED Requirements

### Requirement: Real track bounds fix the viewport from the first frame
Whenever `map.ini` metadata is available (`boundsAvailable`), the track map SHALL project world coordinates through the metadata transform (offsets, scale factor, pixel dimensions). The track map SHALL NOT render the track's `map.png` image: AC draws that image as a constant-width stroke around the AI line, which misrepresents track limits, so the driven lines are the only track depiction and the metadata is used solely for projection and framing. The resulting viewport SHALL be fully determined before the first telemetry frame and SHALL NOT pan, zoom, or re-fit **automatically** at any point: absent user input, the first-lap line draws at the same position and scale it will have on every later lap. User-initiated scroll-wheel zoom (per the `track-map-zoom` capability) MAY magnify this viewport; at 1× zoom the framing is exactly the fixed fit described here.

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
- **THEN** the map image is not fetched or drawn; only the metadata-projected driven lines and car dot appear
