## MODIFIED Requirements

### Requirement: Cut onset detection with gating
The bridge SHALL emit exactly one cut event per off-track excursion: a transition of `numberOfTyresOut` from below 4 to 4 or more, evaluated only across polls with fresh `packetId` values, re-arming once the count drops below 4. An onset SHALL be emitted only while a session is live with a telemetry frame available, the game state (see `game-state`) is neither paused nor replay, the latest frame's `inPit` is false, and the shared-memory speed is at or above a small threshold (~10 km/h) — so teleports, garage states, frozen pages and replays never produce events.

#### Scenario: Four wheels leave the track
- **WHEN** `numberOfTyresOut` reads 2 on one fresh sample and 4 on the next while driving at speed
- **THEN** exactly one cut event is emitted at that transition

#### Scenario: Sustained excursion emits once
- **WHEN** `numberOfTyresOut` stays at 4 across many consecutive samples
- **THEN** no additional events are emitted until the count drops below 4 and reaches 4 again

#### Scenario: Teleport to pits
- **WHEN** the driver teleports to the pit lane and the latest telemetry frame reports `inPit` true (or speed is below the threshold)
- **THEN** no cut event is emitted regardless of transient counter values

#### Scenario: Replay shows an excursion
- **WHEN** the game is in a replay and the physics page shows four tyres out at speed
- **THEN** no cut event is emitted

### Requirement: Mock simulates the physics mapping
On Windows, the mock AC script SHALL create and write the same `Local\acpmf_physics` mapping: an advancing `packetId`, a speed mirroring its UDP speed, a `heading` (offset 208) that points along its car's direction of travel under the same yaw convention the web app converts, and periodic simulated excursions where `numberOfTyresOut` reads 4 for a short window (otherwise 0), so the bridge's real reader and detection path can be exercised end to end without the game. During a simulated pause the physics `packetId` SHALL stop advancing. On other platforms, or when koffi cannot load, the mock SHALL log one line and stream UDP exactly as today.

#### Scenario: Mock drives cut detection
- **WHEN** the mock and bridge run together on Windows
- **THEN** the bridge periodically emits `cut` messages at the mock car's position without the game installed

#### Scenario: Mock drives the yaw path
- **WHEN** the mock and bridge run together on Windows
- **THEN** telemetry messages carry `heading`, and the track-map wedge points along the mock car's path

#### Scenario: Mock on unsupported platform
- **WHEN** the mock runs where the mapping cannot be created
- **THEN** it streams UDP telemetry exactly as before, noting once that shared memory is off
