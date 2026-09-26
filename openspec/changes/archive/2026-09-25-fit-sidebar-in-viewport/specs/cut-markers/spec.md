## MODIFIED Requirements

### Requirement: Markers associate with laps and reveal on demand
Cut markers SHALL attach to laps by the event's lap counter (existing display convention: lapCount N is "Lap N+1"), including a cut that arrives just after its lap completed. Each lap SHALL carry at most one marker: the first cut event attributed to that lap — the moment the lap was invalidated. Every later cut event attributed to a lap that already has a marker SHALL be discarded without being attached or drawn, however far away in time or position it occurred. Only the in-progress lap's marker SHALL be ambiently visible — it leaves the ambient view the moment the lap completes. A stored lap's marker SHALL render only while that lap is hovered: either its line on the track map, or its row in the session-lap list. Markers SHALL be dropped together with their lap when it rolls out of the bounded lap history.

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
- **WHEN** the pointer hovers a lap's row in the session-lap list
- **THEN** that lap's cut marker renders on the track map until the pointer leaves the row

#### Scenario: Lap validity is unaffected
- **WHEN** a lap receives several cut events and only the first is drawn
- **THEN** the lap is still recorded as invalid exactly as before, and the in-progress lap's INV cue behaves unchanged
