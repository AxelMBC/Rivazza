# track-map-viewport (delta)

## MODIFIED Requirements

### Requirement: Real track bounds fix the viewport from the first frame
Whenever `map.ini` metadata is available (`boundsAvailable`), the track map SHALL project world coordinates through the metadata transform (offsets, scale factor, pixel dimensions) — exactly as map-image mode does — even when no map image exists. The resulting viewport SHALL be fully determined before the first telemetry frame and SHALL NOT pan, zoom, or re-fit **automatically** at any point: absent user input, the first-lap line draws at the same position and scale it will have on every later lap. User-initiated scroll-wheel zoom (per the `track-map-zoom` capability) MAY magnify this viewport; at 1× zoom the framing is exactly the fixed fit described here.

#### Scenario: Bounds without image on first load
- **WHEN** the page loads mid-first-lap on a track with `boundsAvailable: true` and `mapAvailable: false`
- **THEN** the driving line renders inside a fixed, correctly scaled viewport identical in framing to the view after the lap completes

#### Scenario: No camera movement during lap one
- **WHEN** the driver completes their first lap with bounds-only rendering and does not touch the mouse wheel
- **THEN** at no point does the drawn line shift, rescale, or recenter — the line only extends

#### Scenario: User zoom is the only camera movement
- **WHEN** the user scroll-zooms during a lap and later returns to 1×
- **THEN** the view changes only in direct response to the wheel input and lands back on the fixed fit framing
