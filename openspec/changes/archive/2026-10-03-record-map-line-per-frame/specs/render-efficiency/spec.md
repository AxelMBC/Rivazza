## ADDED Requirements

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

## MODIFIED Requirements

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
