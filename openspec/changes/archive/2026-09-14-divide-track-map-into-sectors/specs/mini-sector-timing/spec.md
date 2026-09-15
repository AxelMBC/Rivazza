## MODIFIED Requirements

### Requirement: Fixed mini-sector splits per recorded lap
The track SHALL be divided into a fixed number of equal normalized-position slices (sectors, on the order of 8 — few enough that each can be named, pointed at on the track map and reasoned about as a section of circuit, rather than a slice too small to identify). The split SHALL be defined by normalized track position alone and SHALL NOT depend on any recording, so the same division applies to every lap and exists before the first lap is completed. For every recorded lap whose samples cover a given slice, that lap's sector time SHALL be computed as the interpolated elapsed time at the slice end minus at the slice start. Sector times SHALL be derived from recordings on demand (recomputed when recordings change), not stored redundantly. Slices a lap does not fully cover SHALL yield no time for that lap rather than a fabricated one.

The slice count SHALL be a single shared value, so the analysis panel's ribbon and the track map's division can never disagree about how many sectors there are or where they begin.

#### Scenario: Sector times for a complete lap
- **WHEN** a complete lap recording exists
- **THEN** every sector has a time for that lap and the times sum to (approximately) the lap time

#### Scenario: Partial lap yields partial sectors
- **WHEN** a recording starts mid-lap at pos 0.4
- **THEN** slices entirely below 0.4 have no time for that lap

#### Scenario: Division exists without recordings
- **WHEN** no lap has been recorded yet
- **THEN** the sector boundaries are still defined, at the same normalized positions they will have all session

#### Scenario: Panel and map share one count
- **WHEN** the number of sectors changes
- **THEN** the analysis panel's ribbon and the track map's division both change together, from the same value

### Requirement: Theoretical best lap
The panel SHALL display the session's theoretical best lap time — the sum of the best **valid** sector times — alongside the session best lap time, once every sector has at least one valid time. The theoretical best SHALL be computed strictly from the valid-only best-sector table and SHALL NOT be influenced by the sector ownership table, so it always names a time the driver could have driven within track limits. Before full coverage exists the theoretical best SHALL be omitted rather than shown from partial data.

Because the sectors are few and wide, the theoretical best SHALL be understood as a conservative figure: splicing the best of every lap across a handful of long sectors recovers less than across many short ones. This is the intended behaviour — a theoretical best assembled from very fine slices flatters the driver with a time no achievable lap resembles.

#### Scenario: Theoretical best after several laps
- **WHEN** three valid complete laps exist with different strong sectors
- **THEN** the theoretical best shown is the sum of the per-sector minimums and is less than or equal to the session best

#### Scenario: Insufficient coverage
- **WHEN** no single valid lap set covers every sector yet
- **THEN** no theoretical best is displayed

#### Scenario: Cut lap does not lower the theoretical best
- **WHEN** an invalid lap owns several sectors in the ownership ribbon
- **THEN** the theoretical best is unchanged by those times and still sums valid sector bests only
