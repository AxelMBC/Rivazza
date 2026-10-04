## MODIFIED Requirements

### Requirement: Live delta to best lap
The dashboard SHALL display a live delta (in seconds, signed, e.g. "−0.42" / "+1.03") comparing the current lap's elapsed time at the current `normalizedPos` with the reference lap's elapsed time at the same position. The reference SHALL be the fastest complete recorded lap of the session that the lap log has not marked invalid — the same lap the analysis panel uses as its reference — so an invalidated lap SHALL never become the delta reference, however fast. A just-completed lap SHALL qualify only once the lap log has recorded its validity, so a lap later found invalid never drives the delta, even for a frame. When the session restarts and its recordings are discarded, the reference SHALL be discarded with them. Negative (faster) deltas SHALL render in a distinct positive color and positive (slower) deltas in a warning color. While no reference exists, the delta SHALL show a neutral placeholder.

#### Scenario: Faster than best lap
- **WHEN** the current lap is 0.42s ahead of the reference lap at the same track position
- **THEN** the delta reads "−0.42" in the faster color

#### Scenario: First lap of the session
- **WHEN** no complete lap has been recorded yet
- **THEN** the delta area shows a neutral placeholder (e.g., "––.––") instead of a number

#### Scenario: New best lap completed
- **WHEN** a valid lap completes with a time lower than the current reference
- **THEN** that lap's recording becomes the reference for subsequent deltas

#### Scenario: Only lap so far is invalid
- **WHEN** the only complete lap of the session was marked invalid (a cut, or the pit out-lap)
- **THEN** the delta shows the neutral placeholder, matching the Best-lap tile

#### Scenario: Invalid lap faster than the reference
- **WHEN** an invalidated lap completes faster than the current reference
- **THEN** the reference stays on the faster valid lap

#### Scenario: Session restart
- **WHEN** the session restarts and no lap has been completed since
- **THEN** the delta shows the neutral placeholder rather than a delta against a lap from before the restart

#### Scenario: Crossing the line on an invalid lap
- **WHEN** an invalid lap completes and its validity has not yet been recorded in the lap log
- **THEN** the delta keeps its previous reference (or placeholder) throughout, never showing a delta against that lap
