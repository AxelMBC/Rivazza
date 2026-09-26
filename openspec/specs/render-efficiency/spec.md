# render-efficiency

## Purpose
TBD - created by syncing change reduce-web-resource-usage. Update Purpose after review.

## Requirements

### Requirement: Canvas surfaces repaint only when their content changes
Each canvas visualization (track map, G-force meter) SHALL skip repainting on animation frames where nothing it renders has changed, and SHALL repaint when any of its inputs change: a new telemetry frame, pointer hover movement or exit, wheel zoom, or canvas size or devicePixelRatio change. When telemetry stops and all motion has completed, the dashboard's repaint activity SHALL settle to approximately zero.

#### Scenario: Game paused mid-session
- **WHEN** telemetry frames stop arriving and the pointer is not interacting with the dashboard
- **THEN** no canvas repaints occur until telemetry resumes or the user hovers/zooms

#### Scenario: Interaction still repaints while paused
- **WHEN** telemetry is stopped and the user hovers a stored lap line or wheel-zooms the track map
- **THEN** the map repaints with the hover emphasis/readout or new zoom framing immediately

### Requirement: Track map rendering cost is proportional to new content
The track map SHALL cache completed laps and the current lap's already-drawn segments on offscreen layers so that a typical frame's work is compositing those layers plus drawing only newly added segments — not re-projecting and re-stroking every stored sample. Cached layers SHALL be re-rendered when their appearance inputs change (lap added or session reset, zoom, canvas size or devicePixelRatio, projection/viewport change, hovered-lap change), and the composed output SHALL be visually identical to drawing everything directly, including draw order (map image, previous laps, current lap, hover emphasis, hover readout, car dot).

#### Scenario: Late in a long session
- **WHEN** many completed laps are stored and the current lap is thousands of samples long
- **THEN** a frame with one new telemetry sample draws the cached layers and the new segment only, and the rendered image is identical to the previous full-redraw output

#### Scenario: Zoom invalidates the cache
- **WHEN** the user wheel-zooms the map
- **THEN** the cached layers re-render under the new projection and lines remain crisp vectors, identical to pre-change zoom behavior

#### Scenario: Fallback viewport settles
- **WHEN** a track has no map assets and the auto-fit viewport finishes easing toward its target
- **THEN** the viewport snaps to the target and the map stops repainting until new input arrives

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
- **THEN** the track map's line sampling still sees every frame via the full-rate reference, keeping ~1-meter segment spacing at speed

### Requirement: Input-history windows match their documented durations at the state rate
The input-history buffer SHALL cover the G-force meter's recent path, approximately 2 seconds at the throttled state rate, and SHALL hold no more samples than that path draws.

#### Scenario: G-force path length
- **WHEN** the driver has been on track for more than 2 seconds
- **THEN** the G-force meter's faint path covers approximately the last 2 seconds of lateral/longitudinal acceleration, and the buffer holds no older samples
