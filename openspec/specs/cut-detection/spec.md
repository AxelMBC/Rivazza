# cut-detection

## Purpose

Bridge-side reading of AC's `Local\acpmf_physics` shared-memory page on Windows: cut onset detection and gating, an additive `cut` WebSocket message, graceful degradation when shared memory is unavailable, and mock simulation of the mapping.

## Requirements

### Requirement: Bridge reads AC's physics shared-memory page on Windows
On Windows, unless disabled via `AC_SHM=0`, the bridge SHALL open the game's `Local\acpmf_physics` memory-mapped page read-only through FFI (koffi → `OpenFileMappingW` / `MapViewOfFile`) and poll it at ~60 Hz, reading `packetId` (offset 0, int32), `speedKmh` (offset 28, float32), and `numberOfTyresOut` (offset 244, int32) with offset-based buffer reads. A poll tick whose `packetId` has not advanced SHALL be treated as no new data (game paused, in menus, replay, or closed) and consume no sample. While the mapping cannot be opened, the bridge SHALL retry every ~3 s without affecting the UDP/WebSocket path, logging its availability once rather than repeatedly.

#### Scenario: Game running and unpaused
- **WHEN** AC is running a session on the same machine and the physics page updates
- **THEN** the bridge's poller observes advancing `packetId` values and current `numberOfTyresOut` counts

#### Scenario: Game paused or in menus
- **WHEN** `packetId` stops advancing between poll ticks
- **THEN** no samples are consumed and no cut events can be produced until it advances again

#### Scenario: Mapping not yet available
- **WHEN** the bridge starts before AC (or AC is closed)
- **THEN** the open is retried every ~3 s, telemetry bridging continues unaffected, and availability is logged once

### Requirement: Cut onset detection with gating
The bridge SHALL emit exactly one cut event per off-track excursion: a transition of `numberOfTyresOut` from below 4 to 4 or more, evaluated only across polls with fresh `packetId` values, re-arming once the count drops below 4. An onset SHALL be emitted only while a session is live with a telemetry frame available, the latest frame's `inPit` is false, and the shared-memory speed is at or above a small threshold (~10 km/h) — so teleports, garage states, and frozen pages never produce events.

#### Scenario: Four wheels leave the track
- **WHEN** `numberOfTyresOut` reads 2 on one fresh sample and 4 on the next while driving at speed
- **THEN** exactly one cut event is emitted at that transition

#### Scenario: Sustained excursion emits once
- **WHEN** `numberOfTyresOut` stays at 4 across many consecutive samples
- **THEN** no additional events are emitted until the count drops below 4 and reaches 4 again

#### Scenario: Teleport to pits
- **WHEN** the driver teleports to the pit lane and the latest telemetry frame reports `inPit` true (or speed is below the threshold)
- **THEN** no cut event is emitted regardless of transient counter values

### Requirement: Cut events broadcast as an additive WebSocket message
Each detected cut SHALL be broadcast to all WebSocket clients as `{ type: 'cut', lapCount, lapTimeMs, x, z, speedKmh, tyresOut }`, where `lapCount`, `lapTimeMs`, `x`, `z`, and `speedKmh` are stamped from the newest RTCarInfo frame at the moment of detection and `tyresOut` is the counter value that fired the onset. The message SHALL be additive to the existing `BridgeMessage` union — no existing message shape changes — and the web app's `types.ts` SHALL mirror the bridge type exactly.

#### Scenario: Cut event reaches clients
- **WHEN** a cut onset is detected while two WebSocket clients are connected
- **THEN** both receive one `cut` message stamped with the newest frame's lap counter, lap clock, and world position

#### Scenario: Types stay in sync
- **WHEN** `bridge/src/types.ts` defines `CutEvent` and the new union member
- **THEN** `web/src/types.ts` declares the identical type

#### Scenario: Clients ignoring unknown types unaffected
- **WHEN** a client processes only `status`/`session`/`telemetry` messages
- **THEN** `cut` messages cause no errors or behavior change for it

### Requirement: Graceful degradation when shared memory is unavailable
When the platform is not Windows, `AC_SHM=0` is set, koffi fails to load, or the mapping never becomes available (e.g. AC running on a different machine via `AC_HOST`), the bridge SHALL run exactly as before this capability: no cut messages, no errors, no change to telemetry throughput, with at most a single informative log line.

#### Scenario: Kill switch
- **WHEN** the bridge starts with `AC_SHM=0`
- **THEN** no shared-memory access is attempted and the dashboard behaves exactly as before this capability

#### Scenario: Non-Windows platform
- **WHEN** the bridge runs on a non-win32 platform
- **THEN** the FFI module is not loaded (or its failure is swallowed) and everything else works unchanged

#### Scenario: Remote AC host
- **WHEN** `AC_HOST` points at another PC so the local mapping never exists
- **THEN** the UDP dashboard works as today and cut detection stays silently off

### Requirement: Mock simulates the physics mapping
On Windows, the mock AC script SHALL create and write the same `Local\acpmf_physics` mapping: an advancing `packetId`, a speed mirroring its UDP speed, and periodic simulated excursions where `numberOfTyresOut` reads 4 for a short window (otherwise 0), so the bridge's real reader and detection path can be exercised end to end without the game. On other platforms, or when koffi cannot load, the mock SHALL log one line and stream UDP exactly as today.

#### Scenario: Mock drives cut detection
- **WHEN** the mock and bridge run together on Windows
- **THEN** the bridge periodically emits `cut` messages at the mock car's position without the game installed

#### Scenario: Mock on unsupported platform
- **WHEN** the mock runs where the mapping cannot be created
- **THEN** it streams UDP telemetry exactly as before, noting once that shared memory is off
