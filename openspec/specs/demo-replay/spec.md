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

### Requirement: Demo builds interact by click

A demo-replay build SHALL drive its controls by a single click, and SHALL disarm the hover paths those controls use in a live build. The selection SHALL be derived from the same build-time demo flag rather than a second flag or a runtime setting, so a live build can never be configured into click mode.

The controls in scope are the track map's follow-camera button, the session lap-list flyout, the lap-analysis panel, and the instrument cluster's tyre overlay. Each SHALL open or activate on the first click and close or deactivate on a second, and SHALL remain in its new state when the pointer moves away.

Interactions that read out information rather than act as controls SHALL remain pointer-driven in a demo build, identically to a live build: lap-list rows, analysis lap chips, the track map's lap-line readout, and analysis trace scrubbing. Wheel zoom and pinch SHALL be unchanged, a click having no meaning as a zoom gesture.

#### Scenario: Clicking the follow-camera button

- **WHEN** a demo-build viewer clicks the follow button
- **THEN** follow mode activates immediately, with no dwell period and no progress fill

#### Scenario: Hovering a control in a demo build

- **WHEN** a demo-build viewer rests the cursor on the follow button for longer than the live build's dwell
- **THEN** nothing activates and no progress indicator appears

#### Scenario: A revealed panel stays put

- **WHEN** a demo-build viewer clicks the lap-analysis bar and then moves the pointer off it entirely
- **THEN** the panel remains open until it is clicked closed

#### Scenario: Interacting inside an open panel

- **WHEN** a demo-build viewer clicks inside the open session-lap flyout
- **THEN** the flyout stays open

#### Scenario: Readouts stay on hover

- **WHEN** a demo-build viewer hovers an analysis lap chip or a lap-list row
- **THEN** the selection or map emphasis changes on hover, without a click

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

### Requirement: Connection badge suppressed during replay

While demo/replay mode is active, the dashboard SHALL NOT display the live connection-status badge (the pill reading "Live" / "Waiting for game" / "Connecting to bridge…"). The demo indicator alone SHALL communicate the session's nature — a recorded replay must never be labeled "Live". This applies at every viewport width. In normal (non-demo) builds the connection badge SHALL render exactly as it does today.

#### Scenario: No Live pill in a replay

- **WHEN** the app runs in demo mode and the replay is streaming
- **THEN** the header shows the "Demo replay" indicator and no "Live" pill

#### Scenario: Live build unaffected

- **WHEN** the app runs without demo mode and the bridge is connected to the game
- **THEN** the "Live" connection badge renders as before

### Requirement: Demo builds show a demo-specific pre-session state

While demo mode is active and no session has been established yet, the dashboard SHALL NOT render the live build's connecting or waiting screens. A demo viewer has neither a bridge nor a copy of the game, so copy instructing them to start Assetto Corsa or to check that the bridge is running SHALL never appear in a demo build — the same principle that suppresses the "Live" connection badge during replay.

In its place the demo build SHALL show a loading indicator (a spinner or equivalent motion cue with brief accompanying text) while the recording is being fetched and parsed. When the recording cannot be loaded, or contains no messages, the demo build SHALL show a demo-specific failure message describing that the recorded session is unavailable, with no instruction the viewer cannot act on.

Once the replay establishes a session the pre-session state SHALL disappear and the dashboard SHALL render exactly as it does today. Non-demo builds SHALL render their connecting and waiting screens unchanged.

#### Scenario: Recording is loading

- **WHEN** a demo build starts and the bundled recording has not finished fetching and parsing
- **THEN** a loading indicator is shown, and no text mentions the telemetry bridge or starting Assetto Corsa

#### Scenario: Recording cannot be loaded

- **WHEN** the recording fetch fails, or the fetched recording contains no messages
- **THEN** the demo build shows a demo-specific unavailable message rather than the live "Waiting for Assetto Corsa" screen

#### Scenario: Replay begins

- **WHEN** the recording's session message is replayed
- **THEN** the pre-session state is replaced by the dashboard, as in a live session

#### Scenario: Live build unaffected

- **WHEN** the app runs without `VITE_DEMO_MODE` and no session exists
- **THEN** the existing "Connecting to telemetry bridge…" and "Waiting for Assetto Corsa" screens render exactly as before this change
