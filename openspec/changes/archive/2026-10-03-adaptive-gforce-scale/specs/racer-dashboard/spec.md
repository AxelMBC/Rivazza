## MODIFIED Requirements

### Requirement: G-force meter
The dashboard SHALL show a G-force meter plotting lateral (`accGHorizontal`) versus longitudinal (`accGFrontal`) acceleration as a dot inside concentric reference rings (at least 1G and 2G), with the dot's recent path faintly visible. The meter's scale SHALL start with 1G and 2G rings and an outer edge 0.5G beyond the outermost ring. Each time the combined acceleration exceeds that edge, the meter SHALL add the next whole-G ring and move the edge out by 1G, up to a 5G outermost ring, so a crash spike cannot balloon the scale. The scale SHALL NOT shrink back while the dashboard stays mounted, so the rings never jump during a session.

#### Scenario: Hard cornering
- **WHEN** the car corners with sustained lateral acceleration of ~1.5G
- **THEN** the dot sits between the 1G and 2G rings on the corresponding lateral side

#### Scenario: High-downforce car exceeds the default scale
- **WHEN** the combined acceleration first exceeds 2.5G
- **THEN** a 3G ring appears, the edge moves to 3.5G, and the scale stays widened for the rest of the session even after the car slows down

#### Scenario: Car keeps pulling harder
- **WHEN** the combined acceleration later exceeds 3.5G
- **THEN** a 4G ring appears and the edge moves to 4.5G

#### Scenario: Crash spike
- **WHEN** a wall hit produces a single 12G sample
- **THEN** the scale grows no further than a 5G outermost ring (edge at 5.5G) and the dot clamps to the edge

#### Scenario: Road car never exceeds 2.5G
- **WHEN** the combined acceleration stays at or below 2.5G for the whole session
- **THEN** the meter keeps only the 1G and 2G rings, exactly as before
