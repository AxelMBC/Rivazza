## ADDED Requirements

### Requirement: Sector ownership table
Alongside the valid-only best-sector table, the panel SHALL derive a sector **ownership** table
across every complete recorded lap of the session, valid and invalid alike: for each mini-sector,
the lap holding the lowest recorded time for that slice, together with that time and whether that
lap is invalid. Ties SHALL resolve to a single owner deterministically. Slices no lap has covered
SHALL have no owner rather than a fabricated one. The ownership table SHALL be derived on demand
and SHALL NOT feed the valid-only best-sector table or the theoretical best.

#### Scenario: Fastest slice belongs to a cut lap
- **WHEN** an invalid lap has the lowest time for a slice and a valid lap has the next lowest
- **THEN** the ownership table names the invalid lap as that slice's owner and flags it invalid,
  while the best-sector table still holds the valid lap's time

#### Scenario: Uncovered slice
- **WHEN** no recorded lap covers a slice
- **THEN** that slice has no owner

### Requirement: Sector ownership ribbon
The analysis panel SHALL render a mini-sector strip in which each slice is colored by its owner
in the ownership table: a slice owned by a valid lap takes that lap's identity color, and a slice
owned by an invalid lap takes the critical (red) tone, marking a time the driver set but did not
keep. Slices with no owner SHALL render in an inert tone. The strip SHALL be independent of which
lap is selected for analysis, and SHALL be tall enough for its colors to be distinguished at a
glance. All colors SHALL come from semantic design tokens or the shared lap-identity palette.

#### Scenario: Session ownership at a glance
- **WHEN** several valid laps each hold the best time in different slices
- **THEN** each slice renders in the identity color of the lap that owns it

#### Scenario: Cut lap owns a slice
- **WHEN** an invalid lap holds the lowest raw time for a slice
- **THEN** that slice renders in the critical tone

#### Scenario: Strip does not follow the selection
- **WHEN** the driver hovers a different lap row
- **THEN** the ribbon's colors are unchanged

### Requirement: Sector ownership readout
Because the lap-identity palette repeats across a long session, color alone SHALL NOT be the only
way to identify a slice's owner: hovering a slice SHALL show a readout naming the slice, its
owning lap, that lap's time for the slice, and its invalidity when applicable. The readout SHALL
work with hover alone — no click, no keyboard, no window focus — and SHALL disappear when the
pointer leaves the strip.

#### Scenario: Identifying an owner in a long session
- **WHEN** the session has more laps than the identity palette has colors and the driver hovers a
  slice
- **THEN** the readout names the owning lap and its sector time, resolving the color ambiguity

#### Scenario: Readout without window focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over a slice
- **THEN** the readout appears for that slice

#### Scenario: Pointer leaves
- **WHEN** the pointer leaves the strip
- **THEN** the readout disappears

## MODIFIED Requirements

### Requirement: Theoretical best lap
The panel SHALL display the session's theoretical best lap time — the sum of the best **valid**
sector times — alongside the session best lap time, once every mini-sector has at least one valid
time. The theoretical best SHALL be computed strictly from the valid-only best-sector table and
SHALL NOT be influenced by the sector ownership table, so it always names a time the driver could
have driven within track limits. Before full coverage exists the theoretical best SHALL be omitted
rather than shown from partial data.

#### Scenario: Theoretical best after several laps
- **WHEN** three valid complete laps exist with different strong sectors
- **THEN** the theoretical best shown is the sum of the per-slice minimums and is less than or equal to the session best

#### Scenario: Insufficient coverage
- **WHEN** no single valid lap set covers every slice yet
- **THEN** no theoretical best is displayed

#### Scenario: Cut lap does not lower the theoretical best
- **WHEN** an invalid lap owns several slices in the ownership ribbon
- **THEN** the theoretical best is unchanged by those times and still sums valid sector bests only

## REMOVED Requirements

### Requirement: Best-sector comparison presentation
**Reason**: The strip's tri-tone (best / matched / slower) comparison of the selected lap against
the session's best sectors duplicated what the delta trace directly above it already shows, while
no part of the panel answered which lap owns which part of the track. It is replaced by the
sector ownership ribbon, which is selection-independent and surfaces sectors won on invalid laps.

**Migration**: Per-lap sector standing is read from the delta strip; session-wide sector bests are
still summarized by the theoretical best, and per-slice ownership and times are available from the
ownership ribbon's hover readout.
