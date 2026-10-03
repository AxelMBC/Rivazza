## MODIFIED Requirements

### Requirement: Bridge parses the full RTCarInfo packet
The bridge SHALL parse the complete 328-byte RTCarInfo struct and include the following additional fields in every `TelemetryFrame`: `clutch` (0–1), `steerAngle` (degrees, negative = left), `accGFrontal`, `accGHorizontal`, `accGVertical` (G units), `absEnabled`, `absInAction`, `tcEnabled`, `tcInAction`, `inPit`, `engineLimiterOn` (booleans), `carSlope` (radians), `tyreSlip` (see "Per-wheel slip comes from a source AC fills"), and `wheelLoad` (array of 4, newtons, front-left/front-right/rear-left/rear-right). This specification SHALL name each decoded flag exactly as its `TelemetryFrame` field is named, so a reader can grep the specification against the code and find it.

The three acceleration fields SHALL carry the axis their name states, not the name AC's protocol documentation gives the struct slot: `accGHorizontal` is lateral acceleration, read from offset 28 (documented by AC as `accG_vertical`), positive when the car turns left; `accGVertical` is vertical acceleration, read from offset 32 (documented as `accG_horizontal`); `accGFrontal` is longitudinal acceleration, read from offset 36, positive when the car speeds up. All three are the car's motion acceleration in G with gravity excluded.

#### Scenario: Telemetry packet received
- **WHEN** the bridge receives a 328-byte RTCarInfo UDP packet while subscribed
- **THEN** the emitted `TelemetryFrame` contains all previously existing fields plus the new fields, decoded at their correct struct offsets

#### Scenario: Boolean flags decoded from struct bytes
- **WHEN** the RTCarInfo packet has a non-zero byte at a flag offset (e.g., `absInAction` at offset 21)
- **THEN** the corresponding `TelemetryFrame` field is `true`, and `false` when the byte is zero

#### Scenario: Cornering shows up on the lateral field
- **WHEN** the car takes a sustained right-hand corner at ~2G
- **THEN** `accGHorizontal` reads about −2 while `accGVertical` stays near 0 apart from bumps and kerb strikes

#### Scenario: Braking shows up on the longitudinal field
- **WHEN** the car brakes at ~3G in a straight line
- **THEN** `accGFrontal` reads about −3 and `accGHorizontal` stays near 0

## ADDED Requirements

### Requirement: Per-wheel slip comes from a source AC fills
`TelemetryFrame.tyreSlip` SHALL be an array of 4 non-negative, finite slip magnitudes ordered front-left, front-right, rear-left, rear-right, decoded from RTCarInfo's normalised slip block at offset 164 (AC's `ndSlip`). Here ~1 is the tyre's grip peak: a straight reads ~0.05–0.3, cornering at the limit ~0.6–1.0, and a slide or drift well above 1. The bridge SHALL NOT read it from offset 148, which AC leaves at zero for every wheel even while the car is visibly sliding. Each value SHALL be capped at a fixed ceiling, and a non-finite value SHALL be sent as that ceiling. A locked wheel drives the normalisation toward a division by zero (values past 1e6 were observed), and a non-finite number does not survive JSON serialization.

#### Scenario: Wheelspin or drift
- **WHEN** the rear wheels break traction with the game running
- **THEN** the rear-left and rear-right `tyreSlip` values rise clearly above 1 while the fronts stay near their gripping baseline

#### Scenario: Gripping on a straight
- **WHEN** the car accelerates in a straight line without wheelspin
- **THEN** every `tyreSlip` value stays well below 1

#### Scenario: Front lock-up under braking
- **WHEN** the front wheels lock under heavy braking and AC reports an enormous or non-finite normalised slip
- **THEN** the front `tyreSlip` values arrive at the ceiling as finite numbers, never `null`

### Requirement: Mock produces wheel slip
The mock AC script SHALL write normalised slip at RTCarInfo offset 164: a below-1 baseline with periodic short excursions on a subset of wheels (alternating rears only and fronts only). This lets the slip path be checked end to end without the game.

#### Scenario: Mock drives the slip path
- **WHEN** the mock and the bridge run together
- **THEN** telemetry frames periodically carry `tyreSlip` values above the lamp threshold on the excursion's wheels, and near zero otherwise
