# render-efficiency

## Purpose
TBD - created by syncing change reduce-web-resource-usage. Update Purpose after review.

## Requirements

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

### Requirement: Text-layer state updates are decoupled from the telemetry data rate
The dashboard SHALL keep a full-rate (per-message) telemetry reference for canvas consumers while updating React state — which drives text readouts, gauges, and data-derivation hooks — at approximately 30 Hz. A trailing-edge flush SHALL guarantee the final telemetry frame is always applied to state when the stream pauses. Status and session messages SHALL never be throttled. Lap-boundary and session-restart detection SHALL behave identically (detection may be delayed by at most one throttle interval).

#### Scenario: Stream pauses between throttle windows
- **WHEN** the last telemetry frame arrives while a state update is being skipped by the throttle
- **THEN** that frame is applied to state within one throttle interval, and all readouts settle on its values

#### Scenario: Lap completes on a skipped frame
- **WHEN** the frame that increments `lapCount` is skipped by the state throttle
- **THEN** the lap is still detected on the next applied frame, and lap history, delta reference, and track-map lap rollover behave as before

#### Scenario: Track map fidelity unaffected
- **WHEN** telemetry arrives at 60 Hz
- **THEN** the track map's line sampling still sees every frame through the per-message frame subscription, keeping ~1-meter segment spacing at speed

### Requirement: Input-history windows match their documented durations at the state rate
The input-history buffer SHALL cover the G-force meter's recent path, approximately 2 seconds at the throttled state rate, and SHALL hold no more samples than that path draws.

#### Scenario: G-force path length
- **WHEN** the driver has been on track for more than 2 seconds
- **THEN** the G-force meter's faint path covers approximately the last 2 seconds of lateral/longitudinal acceleration, and the buffer holds no older samples

### Requirement: Track map line recording is independent of repainting
The track map SHALL record its driven line from every received telemetry frame at the moment the message arrives, not from its rAF repaint loop, so the recorded line is the same whether the map repainted for every frame, skipped frames between vsyncs, or did not repaint at all because the browser suspended rAF (hidden tab, minimized or fully occluded window). Lap rollover, session-restart detection and cut-marker attachment SHALL happen in that same per-message path. The rAF loop SHALL only draw what has been recorded, and its cached current-lap layer SHALL be rebuilt whenever the current lap's samples belong to a different lap than the ones it cached, regardless of how many samples or laps were recorded since the previous repaint.

#### Scenario: Map hidden while driving
- **WHEN** the dashboard's tab is hidden or its window is fully covered for part of a lap and then shown again
- **THEN** the current lap's line covers the stretch driven while hidden with ~1 m sample spacing, with no gap and no straight chord across it

#### Scenario: Map hidden for longer than a lap
- **WHEN** the map is not repainted while one or more laps are completed and the new current lap has already grown past the previous lap's sample count
- **THEN** on the next repaint the completed laps appear as stored laps and the current-lap line shows only the new lap's samples, with no segment left over from the previous lap

#### Scenario: Two frames between vsyncs
- **WHEN** two telemetry frames arrive between consecutive repaints
- **THEN** both frames are offered to the line recorder, and the 1 m distance gate alone decides which become samples
