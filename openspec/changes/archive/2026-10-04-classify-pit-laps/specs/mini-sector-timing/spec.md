## MODIFIED Requirements

### Requirement: Sector ownership table
Alongside the valid-only best-sector table, the panel SHALL derive a sector **ownership** table across every complete recorded lap of the session that is not a pit lap, valid and invalid alike: for each mini-sector, the lap holding the lowest recorded time for that slice, together with that time and whether that lap is invalid. Pit laps (`out` and `in`) SHALL own no slice, however fast their time for it, because a time set leaving or entering the pit lane says nothing about the driver's pace. Ties SHALL resolve to a single owner deterministically. Slices no eligible lap has covered SHALL have no owner rather than a fabricated one. The ownership table SHALL be derived on demand and SHALL NOT feed the valid-only best-sector table or the theoretical best.

#### Scenario: Fastest slice belongs to a cut lap
- **WHEN** an invalid lap has the lowest time for a slice and a valid lap has the next lowest
- **THEN** the ownership table names the invalid lap as that slice's owner and flags it invalid, while the best-sector table still holds the valid lap's time

#### Scenario: Uncovered slice
- **WHEN** no recorded lap covers a slice
- **THEN** that slice has no owner

#### Scenario: Only an out-lap so far
- **WHEN** the session's only complete recorded lap is an `out` lap
- **THEN** no slice has an owner

#### Scenario: In-lap is fastest in a slice
- **WHEN** an `in` lap has the lowest time for a slice and a valid lap has the next lowest
- **THEN** the valid lap owns that slice
