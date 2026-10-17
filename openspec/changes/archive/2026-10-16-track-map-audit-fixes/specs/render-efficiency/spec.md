## MODIFIED Requirements

### Requirement: Canvas surfaces repaint only when their content changes
Each canvas visualization (track map, G-force meter, lap analysis) SHALL skip repainting on animation frames where nothing it renders has changed, and SHALL repaint when any of its inputs change: a new telemetry frame, pointer hover movement or exit, wheel zoom, canvas size or devicePixelRatio change, or — for the track map — a lap record settling into the lap log after the frame that completed it. A canvas's backing store SHALL be resized only when its device-pixel size (CSS size times devicePixelRatio, rounded to whole pixels) actually changes, so fractional display scaling does not reallocate it on every repaint. When telemetry stops and all motion has completed, the dashboard's repaint activity SHALL settle to approximately zero.

#### Scenario: Game paused mid-session
- **WHEN** telemetry frames stop arriving and the pointer is not interacting with the dashboard
- **THEN** no canvas repaints occur until telemetry resumes or the user hovers/zooms

#### Scenario: Interaction still repaints while paused
- **WHEN** telemetry is stopped and the user hovers a stored lap line or wheel-zooms the track map
- **THEN** the map repaints with the hover emphasis/readout or new zoom framing immediately

#### Scenario: Paused right after crossing the line
- **WHEN** telemetry stops within one throttle interval of a lap completing, before that lap's record reaches the lap log
- **THEN** the map repaints once when the record arrives, so the legend, hover readout and sector owners show the lap's time without waiting for telemetry to resume

#### Scenario: Fractional display scaling
- **WHEN** the dashboard runs at a devicePixelRatio such as 1.25 or 1.5 and a canvas's CSS size times that ratio is not a whole number
- **THEN** repaints reuse the existing backing store, which is resized only when the canvas size or devicePixelRatio changes

### Requirement: Track map rendering cost is proportional to new content
The track map SHALL cache completed laps and the current lap's already-drawn segments on offscreen layers so that a typical frame's work is compositing those layers plus drawing only newly added segments — not re-projecting and re-stroking every stored sample. Cached layers SHALL be re-rendered when their appearance inputs change (lap added or session reset, zoom, canvas size or devicePixelRatio, projection/viewport change, hovered-lap change), and the composed output SHALL be visually identical to drawing everything directly, including draw order (map image, previous laps, current lap, hover emphasis, hover readout, car dot). Because every projection mode is an axis-aligned map with the same scale magnitude on both axes — either axis possibly mirrored — stored laps are kept as world-space paths stroked under the projection's affine transform, which carries a signed scale per axis, so re-rendering under a moving camera costs one native stroke per lap rather than a per-sample projection loop, and a mirrored projection draws cached lines exactly where the car marker is drawn. The newest few current-lap samples stay out of the cache and are drawn per repaint ending exactly at the car marker, because the follow camera draws the marker behind the raw stream and an unclipped line would poke out ahead of it.

#### Scenario: Late in a long session
- **WHEN** many completed laps are stored and the current lap is thousands of samples long
- **THEN** a frame with one new telemetry sample draws the cached layers and the new segment only, and the rendered image is identical to the previous full-redraw output

#### Scenario: Zoom invalidates the cache
- **WHEN** the user wheel-zooms the map
- **THEN** the cached layers re-render under the new projection and lines remain crisp vectors, identical to pre-change zoom behavior

#### Scenario: Fallback viewport settles
- **WHEN** a track has no map assets and the auto-fit viewport finishes easing toward its target
- **THEN** the viewport snaps to the target and the map stops repainting until new input arrives

#### Scenario: Mirrored projection
- **WHEN** a track's projection is X-mirrored
- **THEN** the track surface, edges, stored laps and current lap are drawn mirrored the same way as the car marker, with the same line widths as an unmirrored map
