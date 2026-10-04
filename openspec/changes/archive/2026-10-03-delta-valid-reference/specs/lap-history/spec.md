## MODIFIED Requirements

### Requirement: Validity-aware best-lap display
The Best-lap tile SHALL show the game's `bestLapMs` unless the session lap log knows that exact time belongs to an invalidated lap (the game adopts cut laps as best in some session types) — in that case the tile SHALL show the fastest valid recorded lap instead, or the placeholder when no valid lap exists yet. While the lap just completed has not yet been given its validity in the lap log, the tile SHALL keep the game's `bestLapMs` from before that lap completed, so a lap later found invalid never appears as best, even for a frame. Everywhere the dashboard presents a "best"/"fastest" lap derived from the lap log (analysis panel session best, best-sector baselines, reference lap), only valid laps SHALL qualify.

#### Scenario: Game adopts a cut lap as best
- **WHEN** `bestLapMs` equals the time of a lap the log marked invalid and a slower valid lap exists
- **THEN** the Best-lap tile shows the valid lap's time

#### Scenario: No valid lap yet
- **WHEN** `bestLapMs` equals an invalidated lap's time and no valid lap has been recorded
- **THEN** the Best-lap tile shows the placeholder

#### Scenario: Game best predates the page
- **WHEN** `bestLapMs` matches no recorded lap (set before the dashboard connected)
- **THEN** the tile shows `bestLapMs` unchanged (its validity is unknown, the game is trusted)

#### Scenario: Crossing the line on an invalid lap
- **WHEN** the game adopts a just-completed lap as `bestLapMs` before the lap log has recorded that lap as invalid
- **THEN** the Best-lap tile keeps showing its previous value until the verdict lands, and never shows the invalid lap's time
