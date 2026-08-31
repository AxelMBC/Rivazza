## MODIFIED Requirements

### Requirement: Sector ownership ribbon
The analysis panel SHALL render a mini-sector strip in which each slice is colored by its owner in the ownership table: every owned slice SHALL take its owning lap's identity color, so that ownership is the strip's primary signal regardless of validity. A slice owned by an invalid lap SHALL additionally be marked as invalid — its fill subdued relative to a valid owner's, and a band of the critical (red) tone along one edge of the slice — so that a time the driver set but did not keep is distinguishable at a glance without discarding the identity of the lap that set it. The invalid marking SHALL NOT depend on rendered text, so that it survives at any panel width. Slices with no owner SHALL render in an inert tone. The strip SHALL be independent of which lap is selected for analysis, and SHALL be tall enough for its colors to be distinguished at a glance. All colors SHALL come from semantic design tokens or the shared lap-identity palette.

The strip SHALL occupy the identical horizontal plotting range as the panel's speed, pedal and delta strips, so that the boundary between slice *i* and slice *i+1* falls at the same x as normalized track position `(i+1)/count` in the traces above it. This alignment SHALL hold by construction — the strip and the traces SHALL be positioned from a single shared projection rather than from independently maintained layout values — so it cannot drift when the panel is resized or restyled. The strip SHALL NOT be inset by an adjacent caption or readout element.

#### Scenario: Session ownership at a glance
- **WHEN** several valid laps each hold the best time in different slices
- **THEN** each slice renders in the identity color of the lap that owns it

#### Scenario: Cut lap owns a slice
- **WHEN** an invalid lap holds the lowest raw time for a slice
- **THEN** that slice renders in that lap's identity color, subdued and carrying the critical-tone invalid band

#### Scenario: Two different cut laps own slices
- **WHEN** two distinct invalid laps each own at least one slice
- **THEN** their slices are distinguishable from each other by identity color, and both are distinguishable from the slices owned by valid laps

#### Scenario: Strip does not follow the selection
- **WHEN** the driver hovers a different lap row
- **THEN** the ribbon's colors are unchanged

#### Scenario: Slice boundaries line up with the traces
- **WHEN** the selected lap's speed trace shows its lowest speed at normalized position 0.30
- **THEN** that point of the speed trace sits directly above the slice spanning 0.30, and the boundaries of that slice sit directly below the same x positions in the speed, pedal and delta strips

#### Scenario: Alignment survives a resize
- **WHEN** the panel's width changes
- **THEN** the ribbon still spans exactly the traces' plotting range with no horizontal offset at either end

### Requirement: Sector ownership readout
Because the lap-identity palette repeats across a long session, color alone SHALL NOT be the only way to identify a slice's owner: the panel SHALL show a readout naming the slice, its owning lap, that lap's time for the slice, and its invalidity when applicable. The readout SHALL be driven by the same pointer position that drives the trace scrub — the slice named is the one containing the scrubbed track position — so that pointing anywhere in the panel identifies both the telemetry values and the sector at that point on the track. The readout SHALL work with hover alone — no click, no keyboard, no window focus — and SHALL disappear when the pointer leaves the panel's plotting area. Slices with no owner SHALL produce no readout rather than an empty or fabricated one.

#### Scenario: Identifying an owner in a long session
- **WHEN** the session has more laps than the identity palette has colors and the driver points at a track position inside a slice
- **THEN** the readout names the owning lap and its sector time, resolving the color ambiguity

#### Scenario: Readout follows the scrub, not the strip
- **WHEN** the driver points at the speed trace rather than at the ribbon itself
- **THEN** the readout still names the slice containing that track position and its owner

#### Scenario: Readout without window focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over the plotting area
- **THEN** the readout appears for the slice under the pointer

#### Scenario: Unowned slice under the pointer
- **WHEN** the pointer rests over a slice no recorded lap has covered
- **THEN** no owner readout is shown for it

#### Scenario: Pointer leaves
- **WHEN** the pointer leaves the plotting area
- **THEN** the readout disappears
