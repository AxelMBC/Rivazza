## MODIFIED Requirements

### Requirement: Cut events broadcast as an additive WebSocket message
Each detected cut SHALL be broadcast to all WebSocket clients as `{ type: 'cut', lapCount, lapTimeMs, x, z, speedKmh, tyresOut }`, where `lapCount`, `lapTimeMs`, `x`, `z`, and `speedKmh` are stamped from the newest RTCarInfo frame at the moment of detection and `tyresOut` is the counter value that fired the onset. The message SHALL be additive to the existing `BridgeMessage` union — no existing message shape changes — and `CutEvent` SHALL be declared once, in the shared `@rivazza/protocol` package, which both the bridge and the web app import.

#### Scenario: Cut event reaches clients
- **WHEN** a cut onset is detected while two WebSocket clients are connected
- **THEN** both receive one `cut` message stamped with the newest frame's lap counter, lap clock, and world position

#### Scenario: One declaration for both sides
- **WHEN** `packages/protocol/src/index.ts` defines `CutEvent` and the `cut` union member
- **THEN** the bridge and the web app both import that declaration, and neither workspace declares its own copy

#### Scenario: Clients ignoring unknown types unaffected
- **WHEN** a client processes only `status`/`session`/`telemetry` messages
- **THEN** `cut` messages cause no errors or behavior change for it
