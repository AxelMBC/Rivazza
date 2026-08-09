## ADDED Requirements

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
