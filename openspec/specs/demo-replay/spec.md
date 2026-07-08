# demo-replay

## Purpose

Record the bridge's `BridgeMessage` WebSocket stream to a file, and replay it in the browser under a build-time-gated demo mode. A bridge-side recorder captures a live (or mock) session verbatim with relative frame timing; a Vite build flag (`VITE_DEMO_MODE`) then feeds the bundled recording through the existing telemetry data flow so the dashboard runs indistinguishably from a live session — for hosting a public demo where no live bridge exists. A "Demo" indicator makes clear the data is a recorded replay.

## Requirements

### Requirement: Recorder captures the live BridgeMessage stream to a file

The project SHALL provide a bridge-side recorder that connects to the running bridge as an ordinary WebSocket client and appends every received `BridgeMessage` (`status` | `session` | `telemetry` | `cut`) to a single recording file, each entry stamped with a relative arrival time (milliseconds since the first captured message) so original inter-frame timing can be reconstructed on replay. The recorder SHALL NOT modify or depend on the bridge's UDP ingestion or HTTP/WebSocket serving code — it is purely an additional consumer. The recording SHALL preserve message contents verbatim so replay is indistinguishable from the original session at the wire level.

#### Scenario: Capturing a session

- **WHEN** the recorder runs while a real (or mock) driving session streams over the bridge WebSocket
- **THEN** it writes a recording file containing every `status`, `session`, `telemetry`, and `cut` message in arrival order, each with a relative timestamp

#### Scenario: Recorder does not affect the bridge

- **WHEN** the recorder connects and disconnects
- **THEN** the bridge's telemetry throughput and other WebSocket clients are unaffected, exactly as any other read-only client connecting would be

### Requirement: Demo mode is selected at build time, not runtime or by branch

The web app SHALL enter demo replay mode only when the Vite build-time flag `VITE_DEMO_MODE` is truthy (read via `import.meta.env`). When the flag is unset or falsy, the app SHALL behave byte-for-byte as it does today — opening the bridge WebSocket with auto-reconnect — with no demo code path taken. Demo mode SHALL NOT be gated by a separate git branch or by a server-side runtime variable.

#### Scenario: Default build connects to the bridge

- **WHEN** the app is built or run without `VITE_DEMO_MODE`
- **THEN** `useTelemetry` opens the bridge WebSocket and reconnects on close exactly as before this change

#### Scenario: Demo build replays the recording

- **WHEN** the app is built with `VITE_DEMO_MODE` truthy (e.g. on Vercel)
- **THEN** `useTelemetry` replays the bundled recording and never opens a WebSocket

### Requirement: Replay feeds the recording through the existing telemetry data flow

In demo mode, `useTelemetry` SHALL fetch the bundled recording from a static path under the web app's public assets and emit its messages to the same state and refs used by the live path (`status`, `session`, `telemetry`/`telemetryRef`, `cutsRef`/`cutSeq`), so all downstream consumers (gauges, lap history, track map, cut markers) operate unchanged. Replay SHALL honor the recorded relative timestamps so playback speed matches the original session, and SHALL loop seamlessly when the recording ends, resetting session-scoped state (frame, cuts) as a fresh session would. In demo mode the WebSocket SHALL never be opened and no reconnection timer SHALL be scheduled.

#### Scenario: Downstream consumers see normal data

- **WHEN** the recording replays in demo mode
- **THEN** gauges, lap history, delta, track map lines, and cut markers render as they would from a live bridge, driven by the same refs and state

#### Scenario: Playback timing matches the original

- **WHEN** two consecutive recorded frames were 16 ms apart during capture
- **THEN** they are emitted ~16 ms apart during replay

#### Scenario: Seamless loop

- **WHEN** the recording reaches its final message
- **THEN** replay restarts from the beginning, resetting session-scoped state so the dashboard shows a clean new session rather than stale data

### Requirement: Demo indicator communicates that data is recorded

While demo mode is active, the dashboard SHALL display a small, non-intrusive indicator (e.g. a "Demo" badge) so viewers understand the telemetry is a recorded replay rather than a live session. The indicator SHALL NOT appear in normal (non-demo) builds.

#### Scenario: Badge visible in demo build

- **WHEN** the app runs in demo mode
- **THEN** a "Demo" indicator is visible in the UI

#### Scenario: Badge absent in live build

- **WHEN** the app runs without `VITE_DEMO_MODE`
- **THEN** no demo indicator is rendered
