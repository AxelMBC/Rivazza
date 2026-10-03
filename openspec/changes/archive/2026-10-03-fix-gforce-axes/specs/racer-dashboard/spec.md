## MODIFIED Requirements

### Requirement: G-force meter
The G-force meter SHALL plot each sample's lateral and longitudinal G after smoothing them with an exponential moving average of about 50 ms, so single-frame kerb and bump spikes neither jerk the dot nor widen the ring scale, while sustained loads read within ~0.15G of the car's real acceleration. The dot SHALL show the load the driver feels: toward the outside of a corner, upward under braking and downward under acceleration.

#### Scenario: Hard cornering
- **WHEN** the car corners with sustained lateral acceleration of ~1.5G
- **THEN** the dot sits between the 1G and 2G rings on the side away from the corner (right of centre in a left-hander)

#### Scenario: Braking
- **WHEN** the car brakes in a straight line at ~3G
- **THEN** the dot sits about 3G above the centre

#### Scenario: Kerb strike
- **WHEN** a single telemetry frame reads 1.5G more than the frames around it
- **THEN** the dot moves roughly half as far as that frame's spike and settles back within about 100 ms
