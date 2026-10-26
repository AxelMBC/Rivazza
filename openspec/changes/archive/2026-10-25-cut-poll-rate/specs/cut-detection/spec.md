## MODIFIED Requirements

### Requirement: Bridge reads AC's physics shared-memory page on Windows
On Windows, unless disabled via `AC_SHM=0`, the bridge SHALL open the game's `Local\acpmf_physics` memory-mapped page read-only through FFI (koffi → `OpenFileMappingW` / `MapViewOfFile`) and poll it at ~60 Hz, reading `packetId` (offset 0, int32), `speedKmh` (offset 28, float32), and `numberOfTyresOut` (offset 244, int32) with offset-based buffer reads. The ~60 Hz SHALL be the rate actually achieved under Windows' ~15.6 ms timer granularity, so the poll interval SHALL be shorter than one timer tick: an interval of one tick or longer (16 ms included) rounds up to two ticks and polls at ~32 Hz. A poll tick whose `packetId` has not advanced SHALL be treated as no new data (game paused, in menus, replay, or closed) and consume no sample. While the mapping cannot be opened, the bridge SHALL retry every ~3 s without affecting the UDP/WebSocket path, logging its availability once rather than repeatedly.

#### Scenario: Game running and unpaused
- **WHEN** AC is running a session on the same machine and the physics page updates
- **THEN** the bridge's poller observes advancing `packetId` values and current `numberOfTyresOut` counts

#### Scenario: Poll rate under Windows' coarse timer
- **WHEN** the physics page is mapped on a Windows machine whose timer ticks every ~15.6 ms
- **THEN** the poller runs about 60 or more times per second, not the ~32 Hz a 16 ms interval yields

#### Scenario: Game paused or in menus
- **WHEN** `packetId` stops advancing between poll ticks
- **THEN** no samples are consumed and no cut events can be produced until it advances again

#### Scenario: Mapping not yet available
- **WHEN** the bridge starts before AC (or AC is closed)
- **THEN** the open is retried every ~3 s, telemetry bridging continues unaffected, and availability is logged once
