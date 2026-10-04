## MODIFIED Requirements

### Requirement: Unowned and invalid sectors are marked honestly
A sector no recorded lap owns SHALL carry no lap identity, naming only its number, rather than borrowing a color or naming a lap. A sector whose owner is a lap the game invalidated SHALL be named as invalid in the critical tone, so a time the driver set but did not keep is never presented on the map as a clean best. A pit lap never owns a sector, so it SHALL never be named in a sector label. That cue SHALL live in the label, not in the track edge, for the same reason the owner's color does.

#### Scenario: Fresh session
- **WHEN** no lap has completed yet
- **THEN** every sector is labelled with its number alone and no owner is named

#### Scenario: Sectors fill in as laps land
- **WHEN** the first lap that is not a pit lap completes
- **THEN** the sectors it covers name it in its identity color, without the driver touching anything

#### Scenario: Out-lap leaves the sectors unowned
- **WHEN** the only completed lap is an `out` lap
- **THEN** every sector is labelled with its number alone, with no lap named and nothing in the critical tone

#### Scenario: Sector owned by an invalid lap
- **WHEN** an invalidated lap holds the fastest raw time for a sector
- **THEN** that sector is marked invalid on the map rather than rendering as a clean best
