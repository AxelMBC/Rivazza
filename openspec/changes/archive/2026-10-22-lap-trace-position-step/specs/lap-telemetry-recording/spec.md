## MODIFIED Requirements

### Requirement: Full-rate per-lap telemetry capture
The web app SHALL record a telemetry trace for every lap driven while the app is open, considering every received WebSocket telemetry frame for sampling (not the ~30 Hz throttled React state, and not a rAF loop subject to background-tab throttling). Each sample SHALL record the frame's `normalizedPos`, `lapTimeMs`, `speedKmh`, `gas`, `brake`, `gear`, `steerAngle`, and world `x`/`z`. A sample SHALL be appended only when `normalizedPos` has advanced by at least a fixed minimum step (on the order of a ten-thousandth of a lap) beyond the previous sample of that lap, so traces stay monotonic in track position and every lap's trace holds a bounded number of samples whatever the track length or lap time. The step SHALL be small enough that on a typical short circuit it is below one frame's travel at racing speed, so such traces still keep every frame.

#### Scenario: Sample captured from a live frame
- **WHEN** a telemetry frame arrives with `normalizedPos` at least the minimum step beyond the last recorded sample's position
- **THEN** the in-progress lap's trace gains a sample carrying that frame's position, elapsed time, speed, throttle, brake, gear, steering angle, and world position

#### Scenario: Recording continues while the browser is unfocused
- **WHEN** the browser window is unfocused or occluded (the game has focus) while telemetry frames keep arriving
- **THEN** every frame continues to be considered for sampling at the full stream rate

#### Scenario: Position glitch ignored
- **WHEN** a frame reports a `normalizedPos` less than or equal to the previous sample's position within the same lap
- **THEN** no sample is appended for that frame

#### Scenario: Sub-step advance thinned
- **WHEN** a frame's `normalizedPos` has advanced beyond the previous sample's position by less than the minimum step (a slow corner, or any stretch of a very long track)
- **THEN** no sample is appended for that frame, and the next frame that clears the step is sampled

#### Scenario: Long lap records whole
- **WHEN** a lap lasting several times longer than three minutes (a ~10-minute Nordschleife lap) is driven from line to line
- **THEN** its stored recording covers the whole lap and is flagged complete

### Requirement: Bounded memory with best-lap pinning
The store SHALL cap completed recordings (on the order of tens of laps). Samples per lap SHALL be bounded by the capture requirement's minimum position step rather than by a separate per-lap sample cap, so no lap is truncated however long it runs. When the lap cap is exceeded the oldest recording SHALL be dropped, except the fastest valid complete recording, which SHALL be pinned and never evicted while its session lasts. A recording whose lap has no status in the session lap log yet SHALL NOT be treated as the pinned best.

#### Scenario: Long session evicts oldest but keeps the best
- **WHEN** the lap cap is reached and the oldest stored recording is the session-best valid lap
- **THEN** the second-oldest recording is dropped instead

#### Scenario: Eviction before the new lap's verdict
- **WHEN** the lap cap is exceeded by a just-completed lap that is faster than the session-best valid lap but has no status in the lap log yet, and the oldest stored recording is the session-best valid lap
- **THEN** the session-best valid lap stays pinned and the second-oldest recording is dropped instead

#### Scenario: Stuck lap counter stays bounded
- **WHEN** the lap counter stops incrementing while the car keeps circulating
- **THEN** each line crossing restarts the in-progress trace, so it never holds more than one lap's worth of samples at the minimum step
