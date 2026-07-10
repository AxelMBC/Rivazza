# demo-replay (delta)

## ADDED Requirements

### Requirement: Connection badge suppressed during replay
While demo/replay mode is active, the dashboard SHALL NOT display the live connection-status badge (the pill reading "Live" / "Waiting for game" / "Connecting to bridge…"). The demo indicator alone SHALL communicate the session's nature — a recorded replay must never be labeled "Live". This applies at every viewport width. In normal (non-demo) builds the connection badge SHALL render exactly as it does today.

#### Scenario: No Live pill in a replay
- **WHEN** the app runs in demo mode and the replay is streaming
- **THEN** the header shows the "Demo replay" indicator and no "Live" pill

#### Scenario: Live build unaffected
- **WHEN** the app runs without demo mode and the bridge is connected to the game
- **THEN** the "Live" connection badge renders as before
