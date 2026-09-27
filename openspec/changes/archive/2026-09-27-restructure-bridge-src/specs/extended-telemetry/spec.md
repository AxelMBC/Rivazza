## MODIFIED Requirements

### Requirement: Extended frame streams over the existing WebSocket unchanged in shape
The bridge SHALL stream the extended `TelemetryFrame` through the existing `{ type: 'telemetry', ... }` WebSocket message, adding fields without renaming or removing any existing field, and `TelemetryFrame` SHALL be declared once, in the shared `@rivazza/protocol` package, which both the bridge and the web app import.

#### Scenario: Existing consumers keep working
- **WHEN** the web app receives a telemetry message from an updated bridge
- **THEN** all fields used by the current UI (`speedKmh`, `gear`, `rpm`, lap times, `gas`, `brake`, position fields) are still present with unchanged names and units

#### Scenario: One declaration for both sides
- **WHEN** `packages/protocol/src/index.ts` defines the extended `TelemetryFrame`
- **THEN** the bridge and the web app both import that declaration, and neither workspace declares its own copy
