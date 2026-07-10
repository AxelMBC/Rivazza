# mini-sector-timing

## Purpose
TBD - created by syncing change lap-telemetry-recording. Update Purpose after review.

## Requirements

### Requirement: Fixed mini-sector splits per recorded lap
The track SHALL be divided into a fixed number of equal normalized-position slices (mini-sectors, on the order of 24). For every recorded lap whose samples cover a given slice, that lap's sector time SHALL be computed as the interpolated elapsed time at the slice end minus at the slice start. Sector times SHALL be derived from recordings on demand (recomputed when recordings change), not stored redundantly. Slices a lap does not fully cover SHALL yield no time for that lap rather than a fabricated one.

#### Scenario: Sector times for a complete lap
- **WHEN** a complete lap recording exists
- **THEN** every mini-sector has a time for that lap and the times sum to (approximately) the lap time

#### Scenario: Partial lap yields partial sectors
- **WHEN** a recording starts mid-lap at pos 0.4
- **THEN** slices entirely below 0.4 have no time for that lap

### Requirement: Best-sector comparison presentation
The analysis panel SHALL render a mini-sector strip for the selected lap where each slice is colored by comparison against the best time recorded for that slice across valid laps: best-so-far in the best-lap accent, within a small tolerance of best in a neutral tone, slower in a muted tone — all via semantic design tokens. Sector bests SHALL only be taken from valid laps so a cut lap cannot own a best sector.

#### Scenario: Purple-patch sector
- **WHEN** the selected lap holds the best recorded time for a slice among valid laps
- **THEN** that slice renders in the best-lap accent color

#### Scenario: Cut lap cannot set a best
- **WHEN** an invalid lap has the lowest raw time for a slice
- **THEN** the slice's best remains the fastest time among valid laps only

### Requirement: Theoretical best lap
The panel SHALL display the session's theoretical best lap time — the sum of the best valid sector times — alongside the session best lap time, once every mini-sector has at least one valid time. Before full coverage exists the theoretical best SHALL be omitted rather than shown from partial data.

#### Scenario: Theoretical best after several laps
- **WHEN** three valid complete laps exist with different strong sectors
- **THEN** the theoretical best shown is the sum of the per-slice minimums and is less than or equal to the session best

#### Scenario: Insufficient coverage
- **WHEN** no single valid lap set covers every slice yet
- **THEN** no theoretical best is displayed
