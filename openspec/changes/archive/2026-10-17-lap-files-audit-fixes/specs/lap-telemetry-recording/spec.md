## MODIFIED Requirements

### Requirement: Bounded memory with best-lap pinning
The store SHALL cap completed recordings (on the order of tens of laps) and samples per lap (sized for a multi-minute lap at full rate). When the lap cap is exceeded the oldest recording SHALL be dropped, except the fastest valid complete recording, which SHALL be pinned and never evicted while its session lasts. A recording whose lap has no status in the session lap log yet SHALL NOT be treated as the pinned best. A lap that exceeds the per-lap sample cap SHALL stop appending samples and SHALL be flagged not complete.

#### Scenario: Long session evicts oldest but keeps the best
- **WHEN** the lap cap is reached and the oldest stored recording is the session-best valid lap
- **THEN** the second-oldest recording is dropped instead

#### Scenario: Eviction before the new lap's verdict
- **WHEN** the lap cap is exceeded by a just-completed lap that is faster than the session-best valid lap but has no status in the lap log yet, and the oldest stored recording is the session-best valid lap
- **THEN** the session-best valid lap stays pinned and the second-oldest recording is dropped instead

#### Scenario: Runaway lap hits the sample cap
- **WHEN** an in-progress lap reaches the per-lap sample cap
- **THEN** no further samples are appended and the eventual stored recording is flagged not complete
