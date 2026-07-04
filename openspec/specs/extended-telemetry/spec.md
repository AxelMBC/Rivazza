# extended-telemetry

## Purpose

Parse the full Assetto Corsa RTCarInfo UDP packet in the bridge and stream the extended fields (pedals, steering, G-forces, driving-aid flags, tyre data) to the web app over the existing WebSocket without breaking existing consumers.

## Requirements

### Requirement: Bridge parses the full RTCarInfo packet
The bridge SHALL parse the complete 328-byte RTCarInfo struct and include the following additional fields in every `TelemetryFrame`: `clutch` (0–1), `steerAngle` (degrees, negative = left), `accGFrontal`, `accGHorizontal`, `accGVertical` (G units), `absEnabled`, `absInAction`, `tcEnabled`, `tcInAction`, `inPit`, `engineLimiterOn` (booleans), `carSlope` (radians), `tyreSlip` (array of 4, front-left/front-right/rear-left/rear-right), and `wheelLoad` (array of 4, newtons, same order).

#### Scenario: Telemetry packet received
- **WHEN** the bridge receives a 328-byte RTCarInfo UDP packet while subscribed
- **THEN** the emitted `TelemetryFrame` contains all previously existing fields plus the new fields, decoded at their correct struct offsets

#### Scenario: Boolean flags decoded from struct bytes
- **WHEN** the RTCarInfo packet has a non-zero byte at a flag offset (e.g., `isAbsInAction`)
- **THEN** the corresponding `TelemetryFrame` field is `true`, and `false` when the byte is zero

### Requirement: Extended frame streams over the existing WebSocket unchanged in shape
The bridge SHALL stream the extended `TelemetryFrame` through the existing `{ type: 'telemetry', ... }` WebSocket message, adding fields without renaming or removing any existing field, and the web app's `TelemetryFrame` type SHALL mirror the bridge type exactly.

#### Scenario: Existing consumers keep working
- **WHEN** the web app receives a telemetry message from an updated bridge
- **THEN** all fields used by the current UI (`speedKmh`, `gear`, `rpm`, lap times, `gas`, `brake`, position fields) are still present with unchanged names and units

#### Scenario: Types stay in sync
- **WHEN** `bridge/src/types.ts` defines the extended `TelemetryFrame`
- **THEN** `web/src/types.ts` declares an identical `TelemetryFrame` type
