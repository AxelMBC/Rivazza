## MODIFIED Requirements

### Requirement: Track map marks cut locations
The track map SHALL draw a distinct marker (an × cross in the critical/red tone over a dark halo for contrast) at the world position of each lap's invalidating cut, projected through the same projection as the driving lines — above the track ribbon and lap lines, below the car dot and hover readout. Markers SHALL keep a constant screen size at every zoom level and stay anchored to their world position while zooming or panning.

#### Scenario: Cut appears where it happened
- **WHEN** the first cut event of a lap arrives while driving
- **THEN** a marker appears at that cut's world position on the map within a frame

#### Scenario: Zooming keeps markers registered
- **WHEN** the user scroll-zooms the map
- **THEN** each marker stays anchored to its world position at unchanged screen size

### Requirement: Markers associate with laps and reveal on demand
Cut markers SHALL attach to laps by the event's lap counter (existing display convention: lapCount N is "Lap N+1"), including a cut that arrives just after its lap completed. Each lap SHALL carry at most one marker: the first cut event attributed to that lap — the moment the lap was invalidated. Every later cut event attributed to a lap that already has a marker SHALL be discarded without being attached or drawn, however far away in time or position it occurred. Only the in-progress lap's marker SHALL be ambiently visible — it leaves the ambient view the moment the lap completes. A stored lap's marker SHALL render only while that lap is hovered: either its line on the track map, or its row in the Lap tile's session-lap list. Markers SHALL be dropped together with their lap when it rolls out of the bounded lap history.

#### Scenario: One excursion, one marker
- **WHEN** a single off-track excursion produces several cut events in quick succession (the tyres-out counter dipping below four and back)
- **THEN** only the first event is drawn, as one × at the position where the lap was invalidated

#### Scenario: Two separate excursions in one lap
- **WHEN** a lap records a cut early in the lap and another, unrelated cut later in the same lap
- **THEN** only the earlier one is drawn — the lap died at the first cut and cannot die twice

#### Scenario: Lap completes with its cut
- **WHEN** a lap with a cut marker completes
- **THEN** the marker leaves the ambient map view and remains attached to the stored lap, available on hover

#### Scenario: Hovering a stored lap's line
- **WHEN** any stored lap's line is hovered on the map
- **THEN** its cut marker renders while the hover emphasis lasts and hides when the pointer leaves

#### Scenario: Hovering a session-list row
- **WHEN** the pointer hovers a lap's row in the Lap tile's session-lap list
- **THEN** that lap's cut marker renders on the track map until the pointer leaves the row

#### Scenario: Lap validity is unaffected
- **WHEN** a lap receives several cut events and only the first is drawn
- **THEN** the lap is still recorded as invalid exactly as before, and the in-progress lap's INV cue behaves unchanged
