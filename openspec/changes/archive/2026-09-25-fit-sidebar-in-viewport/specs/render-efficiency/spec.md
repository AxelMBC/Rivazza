## MODIFIED Requirements

### Requirement: Canvas surfaces repaint only when their content changes
Each canvas visualization (track map, G-force meter) SHALL skip repainting on animation frames where nothing it renders has changed, and SHALL repaint when any of its inputs change: a new telemetry frame, pointer hover movement or exit, wheel zoom, or canvas size or devicePixelRatio change. When telemetry stops and all motion has completed, the dashboard's repaint activity SHALL settle to approximately zero.

#### Scenario: Game paused mid-session
- **WHEN** telemetry frames stop arriving and the pointer is not interacting with the dashboard
- **THEN** no canvas repaints occur until telemetry resumes or the user hovers/zooms

#### Scenario: Interaction still repaints while paused
- **WHEN** telemetry is stopped and the user hovers a stored lap line or wheel-zooms the track map
- **THEN** the map repaints with the hover emphasis/readout or new zoom framing immediately

### Requirement: Input-history windows match their documented durations at the state rate
The input-history buffer SHALL cover the G-force meter's recent path, approximately 2 seconds at the throttled state rate, and SHALL hold no more samples than that path draws.

#### Scenario: G-force path length
- **WHEN** the driver has been on track for more than 2 seconds
- **THEN** the G-force meter's faint path covers approximately the last 2 seconds of lateral/longitudinal acceleration, and the buffer holds no older samples
