## MODIFIED Requirements

### Requirement: Bridge parses the full RTCarInfo packet
The bridge SHALL parse the complete 328-byte RTCarInfo struct and include the following additional fields in every `TelemetryFrame`: `clutch` (0–1), `steerAngle` (degrees, negative = left), `accGFrontal`, `accGHorizontal`, `accGVertical` (G units), `absEnabled`, `absInAction`, `tcEnabled`, `tcInAction`, `inPit`, `engineLimiterOn` (booleans), `carSlope` (radians), `tyreSlip` (array of 4, front-left/front-right/rear-left/rear-right), and `wheelLoad` (array of 4, newtons, same order). This specification SHALL name each decoded flag exactly as its `TelemetryFrame` field is named, so a reader can grep the specification against the code and find it.

The three acceleration fields SHALL carry the axis their name states, not the name AC's protocol documentation gives the struct slot: `accGHorizontal` is lateral acceleration, read from offset 28 (documented by AC as `accG_vertical`), positive when the car turns left; `accGVertical` is vertical acceleration, read from offset 32 (documented as `accG_horizontal`); `accGFrontal` is longitudinal acceleration, read from offset 36, positive when the car speeds up. All three are the car's motion acceleration in G with gravity excluded.

#### Scenario: Cornering shows up on the lateral field
- **WHEN** the car takes a sustained right-hand corner at ~2G
- **THEN** `accGHorizontal` reads about −2 while `accGVertical` stays near 0 apart from bumps and kerb strikes

#### Scenario: Braking shows up on the longitudinal field
- **WHEN** the car brakes at ~3G in a straight line
- **THEN** `accGFrontal` reads about −3 and `accGHorizontal` stays near 0
