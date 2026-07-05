## ADDED Requirements

### Requirement: Bridge resolves the current car's top speed
At session handshake the bridge SHALL attempt to resolve the current car's advertised top speed (in km/h) from `content/cars/<carName>/ui/ui_car.json` under the resolved AC install, where `<carName>` is the car identifier from the handshake. The resolved value SHALL be reported on the session message as `topSpeedKmh` (a positive integer number of km/h, or `null` when unavailable). Resolution SHALL run once per session and its result SHALL remain fixed for the life of that session.

#### Scenario: Car with a numeric top speed
- **WHEN** a session starts on a car whose `ui_car.json` has `specs.topspeed` of `"211km/h"`
- **THEN** the session message reports `topSpeedKmh: 211`

#### Scenario: Car whose folder or file is missing
- **WHEN** the car's `ui_car.json` does not exist under the resolved AC install
- **THEN** the session message reports `topSpeedKmh: null` and no error is thrown

### Requirement: Tolerant parsing of ui_car.json and the top speed value
The bridge SHALL extract the top speed without relying on a strict JSON parse, because `ui_car.json` files frequently contain raw control characters that break `JSON.parse`. The `topspeed` value is free text; the bridge SHALL extract the first numeric run as the top speed and SHALL treat placeholder or non-numeric values (e.g. `"--km/h"`, `"---"`, an empty string, or a missing key) as unavailable (`null`). Extraction SHALL tolerate surrounding text and a trailing `+` (e.g. `"322+km/h"` yields `322`).

#### Scenario: Placeholder top speed
- **WHEN** `specs.topspeed` is `"--km/h"`
- **THEN** the resolved top speed is `null`

#### Scenario: Top speed with a plus suffix
- **WHEN** `specs.topspeed` is `"322+km/h"`
- **THEN** the resolved top speed is `322`

#### Scenario: File contains control characters that break strict JSON parsing
- **WHEN** the `ui_car.json` contains raw control characters elsewhere in the document but a well-formed `specs.topspeed` of `"211km/h"`
- **THEN** the resolver still extracts `211` rather than failing on the malformed document
