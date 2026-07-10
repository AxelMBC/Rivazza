# lap-telemetry-recording

## Purpose
TBD - created by syncing change lap-telemetry-recording. Update Purpose after review.

## Requirements

### Requirement: Full-rate per-lap telemetry capture
The web app SHALL record a telemetry trace for every lap driven while the app is open, capturing one sample per received WebSocket telemetry frame (not the ~30 Hz throttled React state, and not a rAF loop subject to background-tab throttling). Each sample SHALL record the frame's `normalizedPos`, `lapTimeMs`, `speedKmh`, `gas`, `brake`, `gear`, and `steerAngle`. A sample SHALL be appended only when `normalizedPos` strictly increased since the previous sample of that lap, so traces stay monotonic in track position.

#### Scenario: Sample captured from a live frame
- **WHEN** a telemetry frame arrives with `normalizedPos` greater than the last recorded sample's position
- **THEN** the in-progress lap's trace gains a sample carrying that frame's position, elapsed time, speed, throttle, brake, gear, and steering angle

#### Scenario: Recording continues while the browser is unfocused
- **WHEN** the browser window is unfocused or occluded (the game has focus) while telemetry frames keep arriving
- **THEN** samples continue to be recorded at the full stream rate

#### Scenario: Position glitch ignored
- **WHEN** a frame reports a `normalizedPos` less than or equal to the previous sample's position within the same lap
- **THEN** no sample is appended for that frame

### Requirement: Line crossings without a lap tick are handled by trace coverage
A large backwards jump in `normalizedPos` (on the order of a wrap, e.g. > 0.5) without a `lapCount` increment SHALL restart the in-progress trace at the line, disambiguated by what the trace covers. When the trace spans the whole lap (start ≤ 0.05, end ≥ 0.95) this is the finish-line crossing of a genuinely completed lap whose `lapCount` increment has not arrived yet — AC reports the position wrap a frame or two before the counter — and the trace SHALL be held and consumed by the imminent lap tick, with post-line samples accruing to the new lap's trace. When the trace does not span the lap (an out-lap from the pit spawn — `lapCount` stays 0 until the first lap completes, so the "current lap" otherwise starts at the spawn and the monotonic guard would reject the entire first flying lap — or a teleport), the pre-line samples belong to no lap and SHALL be discarded. The first flying lap of a session therefore records fully and can be complete.

#### Scenario: First flying lap after pit spawn
- **WHEN** the driver spawns in the pits at pos ≈ 0.9, drives to the line (pos wraps to ≈ 0), and completes lap 1
- **THEN** lap 1's stored recording covers the whole lap (flagged complete), not just the pit-to-line sliver

#### Scenario: Position wraps before the lap counter increments
- **WHEN** the position wraps at the finish line while `lapCount` increments only one or two frames later
- **THEN** the completed lap's full trace is stored (not the post-line sliver), and the samples received between the wrap and the tick belong to the new lap's trace

### Requirement: Lap boundary promotes the recording with its refreshed time
When `lapCount` increments, the in-progress trace SHALL be stored as a completed lap recording labeled with the display lap number convention (lapCount N completes "Lap N+1") and stamped with the completed lap's `lastLapMs`, applying the same freshness discipline as the session lap log (wait for `lastLapMs` to visibly refresh, or trust the value after a bounded number of frames). A completed recording SHALL be flagged `complete` only when its samples cover at least the [0.05, 0.95] span of normalized position. A new in-progress trace starts at the boundary.

#### Scenario: Clean lap completion
- **WHEN** `lapCount` increments and `lastLapMs` refreshes to the finished lap's time
- **THEN** the finished trace is stored as that lap's recording with that time, and subsequent samples accrue to a fresh in-progress trace

#### Scenario: Out-lap is not complete
- **WHEN** a lap's recording begins mid-lap (e.g. leaving the pits at pos 0.4) and the lap then completes
- **THEN** the stored recording is flagged not complete

### Requirement: Session-scoped lifetime with restart semantics
The recording store SHALL clear entirely when the session changes and when a session restart is detected using the same signature as the existing lap bookkeeping (lap counter decreasing, or the current lap time running backwards within the same lap); on restart the in-progress trace SHALL be discarded, not stored.

#### Scenario: Session restart mid-lap
- **WHEN** telemetry shows the lap clock running backwards within the same lap
- **THEN** all stored recordings and the in-progress trace are cleared

#### Scenario: New session
- **WHEN** a new session message arrives (different track or car)
- **THEN** the recording store is empty for the new session

### Requirement: Bounded memory with best-lap pinning
The store SHALL cap completed recordings (on the order of tens of laps) and samples per lap (sized for a multi-minute lap at full rate). When the lap cap is exceeded the oldest recording SHALL be dropped, except the fastest valid complete recording, which SHALL be pinned and never evicted while its session lasts. A lap that exceeds the per-lap sample cap SHALL stop appending samples and SHALL be flagged not complete.

#### Scenario: Long session evicts oldest but keeps the best
- **WHEN** the lap cap is reached and the oldest stored recording is the session-best valid lap
- **THEN** the second-oldest recording is dropped instead

#### Scenario: Runaway lap hits the sample cap
- **WHEN** an in-progress lap reaches the per-lap sample cap
- **THEN** no further samples are appended and the eventual stored recording is flagged not complete

### Requirement: Ref-based exposure with a change signal
The store SHALL be exposed following the established derived-data hook pattern: recordings readable through a ref (safe for rAF consumers at any frequency without re-renders), plus a monotonically increasing version signal that React consumers can depend on to re-render when recordings change. Lap validity SHALL NOT be re-derived by the store; consumers join recordings to the session lap log by lap number.

#### Scenario: Canvas consumer reads without re-render
- **WHEN** a rAF loop reads the recordings ref every frame
- **THEN** no React re-renders are triggered by those reads

#### Scenario: React consumer re-renders on lap completion
- **WHEN** a lap recording is stored
- **THEN** the version signal changes so state-driven consumers update
