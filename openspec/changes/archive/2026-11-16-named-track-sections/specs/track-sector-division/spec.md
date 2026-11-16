## MODIFIED Requirements

### Requirement: The track is divided into sectors as a property of the circuit
The track map SHALL divide the track by the same sector division the analysis panel divides laps by — the same number of sectors, with boundaries at the same normalized track positions and the same names — so that a sector named in the panel and a sector shown on the map are the same piece of track by construction rather than by agreement. The map SHALL take that division from the one shared derivation and SHALL NOT derive its own.

The division SHALL be located on the map from the **track's own geometry** — the edge polylines the map already draws, whose vertices carry normalized track position — and SHALL NOT be derived from any recorded lap. Two consequences are required, not incidental: the division SHALL be present before any lap has been completed, and it SHALL be identical for every lap, because no lap takes part in producing it.

#### Scenario: Division before the first lap
- **WHEN** a session starts on a track with edge data and the driver has not completed a lap
- **THEN** the track is already divided into sectors

#### Scenario: Division does not depend on the lap shown
- **WHEN** laps with visibly different driving lines are stored and displayed
- **THEN** every sector boundary stays at the same place on the track

#### Scenario: Boundaries agree with the panel
- **WHEN** the panel's ribbon marks the boundary between two slices
- **THEN** the map's boundary between the same two sectors is at the same normalized track position

#### Scenario: Named division on the map
- **WHEN** the session's division follows the track's named sections
- **THEN** the map shows one sector per named section, with each boundary where the panel's ribbon has it

### Requirement: Each sector names the lap that owns it
Each sector SHALL carry a label naming the sector and the lap holding the fastest time for it, taken from the existing cross-lap ownership table, so the map answers "which lap was fastest here" directly and without hover. The sector SHALL be named by its name where the division carries names, and by its number otherwise. The label SHALL be rendered in that lap's identity color.

The owner SHALL be named in text rather than painted onto the track. The lap-identity palette repeats
and there are more sectors than palette entries, so color could not identify an owner unambiguously
in any case; and applied to a surface as large as a sector's edges it overwhelms the driving lines.
Text is both unambiguous and small. The label SHALL be placed **off the track surface**, offset from the edge along the
cross-track direction and on the side facing away from the track's centre, so that no label sits on
asphalt or over a driving line. The label SHALL be readable without hovering anything.

A division can have more sectors than the map has room to label at the current zoom. A label that would overlap a label already placed SHALL be omitted rather than drawn over it, with longer sectors placed first so the labels that survive are the ones with the most track to sit beside. Which labels are omitted SHALL be decided when the cached layer is rebuilt, so labels return as the driver zooms in and the choice is stable between rebuilds. Omitting a label SHALL NOT omit that sector's boundary ticks. The scrubbed sector's label SHALL always be drawn, whether or not it was omitted from the layer.

#### Scenario: Reading ownership at a glance
- **WHEN** several laps each hold the fastest time in different sectors
- **THEN** each sector is labelled with its name or number and its owning lap, in that lap's color, with no
  pointer interaction

#### Scenario: Two owners sharing a palette color
- **WHEN** two sectors are owned by laps that map to the same palette entry
- **THEN** the labels still name each owner unambiguously

#### Scenario: Labels stay off the asphalt
- **WHEN** the labels are drawn
- **THEN** none of them overlaps the track surface or a driving line

#### Scenario: Named sector label
- **WHEN** the division carries names and Lap 3 owns the sector named `Flugplatz`
- **THEN** that sector's label reads `Flugplatz` and names Lap 3, in Lap 3's identity color

#### Scenario: Crowded map at full fit
- **WHEN** the whole Nordschleife is fitted in the map and the labels of several short neighbouring sectors would overlap
- **THEN** no two labels overlap, the omitted sectors still show their boundary ticks, and the labels of the longest sectors are among those drawn

#### Scenario: Zooming in reveals omitted labels
- **WHEN** the driver zooms into a stretch whose labels were omitted at full fit
- **THEN** those labels are drawn once there is room for them

#### Scenario: Scrubbing a sector whose label was omitted
- **WHEN** the driver scrubs a track position inside a sector whose label is omitted at the current zoom
- **THEN** that sector's label is drawn, highlighted, for as long as the scrub lasts

### Requirement: Unowned and invalid sectors are marked honestly
A sector no recorded lap owns SHALL carry no lap identity, naming only itself — its name where the division carries names, its number otherwise — rather than borrowing a color or naming a lap. A sector whose owner is a lap the game invalidated SHALL be named as invalid in the critical tone, so a time the driver set but did not keep is never presented on the map as a clean best. A pit lap never owns a sector, so it SHALL never be named in a sector label. That cue SHALL live in the label, not in the track edge, for the same reason the owner's color does.

#### Scenario: Fresh session
- **WHEN** no lap has completed yet
- **THEN** every sector is labelled with its name or number alone and no owner is named

#### Scenario: Sectors fill in as laps land
- **WHEN** the first lap that is not a pit lap completes
- **THEN** the sectors it covers name it in its identity color, without the driver touching anything

#### Scenario: Out-lap leaves the sectors unowned
- **WHEN** the only completed lap is an `out` lap
- **THEN** every sector is labelled with its name or number alone, with no lap named and nothing in the critical tone

#### Scenario: Sector owned by an invalid lap
- **WHEN** an invalidated lap holds the fastest raw time for a sector
- **THEN** that sector is marked invalid on the map rather than rendering as a clean best
