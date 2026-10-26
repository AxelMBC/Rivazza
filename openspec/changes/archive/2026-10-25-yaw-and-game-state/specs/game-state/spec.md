## ADDED Requirements

### Requirement: Bridge reads the game's run state from the graphics page
On Windows, unless disabled via `AC_SHM=0`, the bridge SHALL open the game's `Local\acpmf_graphics` memory-mapped page read-only through the same FFI path as the physics page, and read `packetId` (offset 0, int32) and `status` (offset 4, int32), mapping `status` 0 to off, 1 to replay, 2 to live and 3 to paused. It SHALL poll the page at ~10 Hz, record when `packetId` last advanced, retry the mapping every ~3 s while it cannot be opened, and log its availability once rather than repeatedly. Where the page cannot be read (not Windows, `AC_SHM=0`, koffi failure, AC on another PC), the game state SHALL be unknown, and every behaviour below that depends on it SHALL behave exactly as before this capability.

#### Scenario: Game paused on the same PC
- **WHEN** the driver pauses AC while the bridge has the graphics page mapped
- **THEN** within about a tenth of a second the bridge's game state reads paused

#### Scenario: Shared memory unavailable
- **WHEN** the bridge runs with `AC_SHM=0`, or `AC_HOST` points at another PC
- **THEN** the game state stays unknown, telemetry flows, and sessions start and end exactly as before this capability

### Requirement: Telemetry is held while the game is paused or in a replay
While the game state is paused or replay, the bridge SHALL forward no telemetry frame to WebSocket clients and SHALL emit no cut event. Each arriving frame SHALL be judged by a read of the graphics page at its arrival, not by the last ~10 Hz poll, so that no frame arriving after the game left the live state reaches clients. When the game state is live or unknown, frames SHALL flow exactly as before this capability.

#### Scenario: Paused with UDP still flowing
- **WHEN** the game is paused and AC keeps sending identical RTCarInfo packets
- **THEN** clients receive no telemetry messages until the game is live again, and the dashboard keeps showing the last live frame

#### Scenario: Replay streams replayed frames
- **WHEN** the driver watches a replay and AC sends UDP frames from an earlier point of the session
- **THEN** none reach clients, so no lap is recorded from them and the lap log is never reset by their lap counter or lap clock

#### Scenario: Back to driving
- **WHEN** the game returns from paused or replay to live
- **THEN** telemetry messages resume with the next arriving frame

### Requirement: Status messages carry the game state
Every `status` message with `state: "connected"` SHALL carry an optional `game` field, `"live"`, `"paused"` or `"replay"`, whenever the game state is known, and SHALL omit it while the state is unknown. The connected greeting a newly connected client receives SHALL carry the current state. During a live session, the bridge SHALL broadcast a connected `status` message to every client each time the game state changes between live, paused and replay. `GameState` SHALL be declared once, in `@rivazza/protocol`, and because `game` is an optional field that older peers ignore, it SHALL NOT change `PROTOCOL_VERSION`.

#### Scenario: Pausing mid-session
- **WHEN** the driver pauses during a live session with two dashboards connected
- **THEN** both receive one `status` message with `state: "connected"` and `game: "paused"`

#### Scenario: Connecting during a pause
- **WHEN** a dashboard connects while the game is paused
- **THEN** its greeting `status` carries `game: "paused"`, followed by the `session` message as usual

#### Scenario: Older recording or remote bridge
- **WHEN** the web app receives a connected `status` with no `game` field
- **THEN** it treats the game as live

### Requirement: Dashboard shows the paused and replay states
In a live build, the connection badge SHALL read "Paused" with a steady warning-toned dot while the game state is paused, and "In replay" with an accent-toned dot while it is replay, returning to "Live" when the game is live again. Pause and replay SHALL NOT clear the session, the last frame, the lap log or the track map. Demo builds keep suppressing the connection badge.

#### Scenario: Pause and resume
- **WHEN** the driver pauses, waits ten seconds and resumes
- **THEN** the badge reads "Paused" during the pause and "Live" after, with every lap and line of the session still shown

#### Scenario: Replay
- **WHEN** the driver opens a replay from the pause menu
- **THEN** the badge reads "In replay" until the game is back to paused or live

### Requirement: Sessions survive pause and replay and end promptly when the game goes off
The stale-telemetry timeout SHALL NOT end a session while the game state is paused or replay and the graphics page's `packetId` has advanced within the last ~2 s. Instead it SHALL wait again, and SHALL end the session as before once either condition fails. When the game state turns off after the page has reported a state other than off, with an advancing `packetId`, during the current session, the bridge SHALL end that session at once, exactly as the stale-telemetry timeout does. An off state that was never preceded by such a report in the current session SHALL NOT end it. Where the game state is unknown, sessions SHALL end only by the stale-telemetry timeout, as before.

#### Scenario: Long replay with no UDP
- **WHEN** AC stops sending UDP frames during a replay that lasts longer than the stale-telemetry timeout
- **THEN** the session stays live and the dashboard keeps its laps

#### Scenario: Quitting the session
- **WHEN** the driver quits the session and the graphics page turns to off
- **THEN** the dashboard shows the waiting state within about a tenth of a second, not after ~5 s

#### Scenario: Game crashes
- **WHEN** AC exits without writing off, leaving the page frozen at live
- **THEN** the session ends by the stale-telemetry timeout, as before

#### Scenario: Stale page from an earlier run
- **WHEN** a new session starts while the mapped page still holds an earlier run's last state, and AC then writes off while loading
- **THEN** the new session is not ended, because the page never reported a live, paused or replay state with an advancing `packetId` during it

### Requirement: Mock simulates the graphics page, a pause and a replay
On Windows, the mock AC script SHALL create and write `Local\acpmf_graphics` with a `packetId` that advances on every tick, the replay state included, and the current `status`. Every couple of minutes it SHALL simulate, alternately, a few seconds of pause and a few seconds of replay. During the pause, its clock stops, UDP keeps streaming the frozen frame, and the physics `packetId` stops advancing. During the replay, UDP streams frames from an earlier point of its lap. It SHALL log each transition. On other platforms, or when koffi cannot load, the mock SHALL stream UDP exactly as today.

#### Scenario: Mock drives the pause path
- **WHEN** the mock and the bridge run together on Windows and the mock enters its simulated pause
- **THEN** the dashboard badge reads "Paused" and telemetry messages stop until the mock resumes

#### Scenario: Mock drives the replay path
- **WHEN** the mock enters its simulated replay and streams rewound frames
- **THEN** the badge reads "In replay", and the session's laps and current-lap line are unchanged after it ends
