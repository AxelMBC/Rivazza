# extended-telemetry (delta)

## ADDED Requirements

### Requirement: Broadcast rate sustains meter-scale line sampling
The bridge SHALL deliver the newest telemetry frame to WebSocket clients at least 60 times per second while fresh frames are arriving at or above that rate, so that consecutive frames are no more than ~1 m apart at racing speeds and the track map's 1 m line-sampling intent holds everywhere on track. Delivery SHALL NOT rely solely on coarse OS timers (Windows quantizes short intervals to ~15.6 ms ticks, which caps a naive 60 Hz interval at ~32 Hz). The keep-only-newest-frame throttling model SHALL be preserved — the bridge still never queues or replays stale frames.

#### Scenario: Sample spacing at top speed
- **WHEN** the car travels at 200 km/h (~55.6 m/s) with the game flooding RTCarInfo packets
- **THEN** clients receive frames spaced no more than ~1 m of travel apart

#### Scenario: Newest-frame semantics unchanged
- **WHEN** multiple RTCarInfo packets arrive between two broadcast ticks
- **THEN** only the newest frame is broadcast and the rest are discarded
