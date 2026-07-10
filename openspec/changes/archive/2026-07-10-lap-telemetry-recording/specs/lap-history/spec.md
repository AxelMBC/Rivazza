# lap-history (delta)

## ADDED Requirements

### Requirement: Validity-aware best-lap display
The Best-lap tile SHALL show the game's `bestLapMs` unless the session lap log knows that exact time belongs to an invalidated lap (the game adopts cut laps as best in some session types) — in that case the tile SHALL show the fastest valid recorded lap instead, or the placeholder when no valid lap exists yet. Everywhere the dashboard presents a "best"/"fastest" lap derived from the lap log (analysis panel session best, best-sector baselines, reference lap), only valid laps SHALL qualify.

#### Scenario: Game adopts a cut lap as best
- **WHEN** `bestLapMs` equals the time of a lap the log marked invalid and a slower valid lap exists
- **THEN** the Best-lap tile shows the valid lap's time

#### Scenario: No valid lap yet
- **WHEN** `bestLapMs` equals an invalidated lap's time and no valid lap has been recorded
- **THEN** the Best-lap tile shows the placeholder

#### Scenario: Game best predates the page
- **WHEN** `bestLapMs` matches no recorded lap (set before the dashboard connected)
- **THEN** the tile shows `bestLapMs` unchanged (its validity is unknown, the game is trusted)
