# track-sector-division

## Purpose
Divides the track map into a fixed number of sectors as a property of the
circuit rather than of any lap, so that a sector named in the analysis panel is a
visible stretch of track. Boundary positions come from the track's own edge
geometry (owned by `track-limits`); the sector split itself and the ownership
table are owned by `mini-sector-timing`. This capability covers only how the
division is drawn and emphasized on the map.

## Requirements

### Requirement: The track is divided into sectors as a property of the circuit
The track map SHALL divide the track into the same fixed number of sectors the analysis panel divides
laps into, with boundaries at the same normalized track positions, so that a sector named in the panel
and a sector shown on the map are the same piece of track by construction rather than by agreement.

The division SHALL be resolved from the **track's own geometry** — the edge polylines the map already
draws, whose vertices carry normalized track position — and SHALL NOT be derived from any recorded
lap. Two consequences are required, not incidental: the division SHALL be present before any lap has
been completed, and it SHALL be identical for every lap, because no lap takes part in producing it.

#### Scenario: Division before the first lap
- **WHEN** a session starts on a track with edge data and the driver has not completed a lap
- **THEN** the track is already divided into sectors

#### Scenario: Division does not depend on the lap shown
- **WHEN** laps with visibly different driving lines are stored and displayed
- **THEN** every sector boundary stays at the same place on the track

#### Scenario: Boundaries agree with the panel
- **WHEN** the panel's ribbon marks the boundary between two slices
- **THEN** the map's boundary between the same two sectors is at the same normalized track position

### Requirement: The division is marked outward of the track, never across it
Sector boundaries SHALL NOT be drawn as marks struck across the track surface. The racing line is what
the map exists to show, and a mark across the asphalt obscures it and is indistinguishable from any
other mark on the line.

Instead, each boundary SHALL be marked by a short tick that grows **outward from the track edge**,
away from the asphalt, on both sides of the track. The asphalt between the edges SHALL be left clear.

The edge strokes themselves SHALL stay a single neutral tone and SHALL NOT carry lap-identity colors.
A saturated hue on the edge is the same visual language as a driving line, and at the width a hue
needs to register the edges read as two more laps and swamp the real ones. Edge strokes and driving
lines SHALL both stay thin enough that laps overlapping through a corner remain individually
distinguishable. The division SHALL be visible at all times without hover, selection, or any panel
being open.

#### Scenario: Racing line is unobstructed
- **WHEN** the division is drawn
- **THEN** nothing is drawn across the track surface and the driving lines are fully visible along
  their whole length

#### Scenario: A boundary is marked outward
- **WHEN** the division is drawn
- **THEN** each boundary carries a tick extending away from the track on both edges, and no part of
  that mark falls on the asphalt

#### Scenario: Edges stay neutral
- **WHEN** several laps own different sectors
- **THEN** the track edges render in one neutral tone throughout, and the only saturated colors on
  the map are the driving lines and the sector labels

#### Scenario: Overlapping laps stay distinguishable
- **WHEN** several laps run close together through a corner
- **THEN** their lines can still be told apart from each other and from the track edge

#### Scenario: Always visible
- **WHEN** the pointer is nowhere near the dashboard and the analysis panel is collapsed
- **THEN** the division is drawn

#### Scenario: Division survives zoom
- **WHEN** the driver zooms and pans the map
- **THEN** each sector's edge run stays registered with the track edges at every zoom level

### Requirement: Each sector names the lap that owns it
Each sector SHALL carry a label naming the sector and the lap holding the fastest time for it, taken
from the existing cross-lap ownership table, so the map answers "which lap was fastest here" directly
and without hover. The label SHALL be rendered in that lap's identity color.

The owner SHALL be named in text rather than painted onto the track. The lap-identity palette repeats
and there are more sectors than palette entries, so color could not identify an owner unambiguously
in any case; and applied to a surface as large as a sector's edges it overwhelms the driving lines.
Text is both unambiguous and small. The label SHALL be placed **off the track surface**, offset from the edge along the
cross-track direction and on the side facing away from the track's centre, so that no label sits on
asphalt or over a driving line. The label SHALL be readable without hovering anything.

#### Scenario: Reading ownership at a glance
- **WHEN** several laps each hold the fastest time in different sectors
- **THEN** each sector is labelled with its number and its owning lap, in that lap's color, with no
  pointer interaction

#### Scenario: Two owners sharing a palette color
- **WHEN** two sectors are owned by laps that map to the same palette entry
- **THEN** the labels still name each owner unambiguously

#### Scenario: Labels stay off the asphalt
- **WHEN** the labels are drawn
- **THEN** none of them overlaps the track surface or a driving line

### Requirement: Unowned and invalid sectors are marked honestly
A sector no recorded lap has covered SHALL carry no lap identity, naming only its number, rather
than borrowing a color or naming a lap. A sector whose owner is a lap the game invalidated SHALL be
named as invalid in the critical tone, so a time the driver set but did not keep is never presented on
the map as a clean best. That cue SHALL live in the label, not in the track edge, for the same reason
the owner's color does.

#### Scenario: Fresh session
- **WHEN** no lap has completed yet
- **THEN** every sector is labelled with its number alone and no owner is named

#### Scenario: Sectors fill in as laps land
- **WHEN** the first lap completes
- **THEN** the sectors it covers name it in its identity color, without the driver touching anything

#### Scenario: Sector owned by an invalid lap
- **WHEN** an invalidated lap holds the fastest raw time for a sector
- **THEN** that sector is marked invalid on the map rather than rendering as a clean best

### Requirement: The scrubbed sector is emphasized on the map
While the driver scrubs a lap's traces in the analysis panel, the map SHALL emphasize the sector
containing the scrubbed position — its edge runs brightened in a neutral tone **at the same width they
always have**, its boundary ticks lengthened and its label highlighted — so that the
driver can see on the track which sector they are inspecting in that lap. The sector emphasized SHALL
be the one the panel resolved from the pointer, so the panel's band and the map's emphasis can never
name different sectors. The existing scrub ring SHALL remain, marking the exact scrubbed position
within the emphasized sector. The emphasis SHALL work with hover alone — no click, no keyboard, no
window focus — and SHALL disappear together with the panel's cursor, band and readout when the pointer
leaves the strips, leaving the division itself drawn.

#### Scenario: Seeing which sector is under the cursor
- **WHEN** the driver scrubs a lap's speed trace
- **THEN** the sector containing that track position is emphasized on the map and the scrub ring sits
  within it

#### Scenario: Emphasis does not move the track limits
- **WHEN** a sector is emphasized
- **THEN** its edge strokes change colour only, keeping the width they have everywhere else, so the
  apparent edge of the track does not shift

#### Scenario: Panel and map name the same sector
- **WHEN** the panel bands one slice column
- **THEN** the map emphasizes that same sector

#### Scenario: Scrub ends
- **WHEN** the pointer leaves the trace strips
- **THEN** the emphasis and the scrub ring disappear while the division stays drawn

### Requirement: No track geometry, no division
Where the track's edge geometry is unavailable, the division SHALL be omitted entirely and the map
SHALL render exactly as it does without this capability — no boundary marks, no labels, no placeholder and no
error state. A track with no edge data has no track surface drawn either, so there is nothing to
divide, and a division inferred from anything other than the track's own geometry would reintroduce
the per-lap boundaries this capability exists to eliminate.

#### Scenario: Track without edge data
- **WHEN** the track ships no usable AI spline and the map draws driving lines on empty space
- **THEN** no sector division, labels or boundary marks are drawn

### Requirement: The division costs no extra repaints
The division SHALL NOT add a wakeup source to the track map's dirty-gated render loop. The boundary ticks and labels SHALL live in the cached track-surface layer, which SHALL be rebuilt only when
the projection changes or when sector ownership changes — that is, when a lap completes or is
invalidated — and never per frame. Only the scrub emphasis SHALL be drawn per repaint, and it SHALL
cover a single sector.

#### Scenario: Idle map
- **WHEN** telemetry, pointer, zoom and canvas size are all unchanged
- **THEN** the division causes no additional repaints

#### Scenario: Scrubbing reuses the layer
- **WHEN** the pointer scrubs across the panel's traces without the projection or ownership changing
- **THEN** the cached layer is blitted rather than rebuilt, and only the emphasized sector is stroked
  on top

#### Scenario: A lap completes
- **WHEN** a lap completes and takes ownership of a sector
- **THEN** the cached layer is rebuilt once and the new owner's color appears
