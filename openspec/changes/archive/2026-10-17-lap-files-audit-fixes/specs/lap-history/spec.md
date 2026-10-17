## MODIFIED Requirements

### Requirement: Heuristic lap invalidity
A recorded lap SHALL be marked `invalid` when either: (a) a cut event (from the bridge's shared-memory cut detection) was received during that lap — matched by lap counter, including a cut that arrives while the completed lap's record is still pending its refreshed time, and a cut stamped with a lap the dashboard's lap state has not reached yet, which is attributed once that state catches up — or (b) it is not a pit lap and its time beat the `bestLapMs` in effect before the lap completed but `bestLapMs` did not adopt it. When no prior best exists, a completed lap that is not a pit lap and leaves `bestLapMs` unset SHALL also be marked invalid. A lap matching neither condition SHALL be recorded as a pit lap when `inPit` was true on any of its frames, and as valid otherwise. The heuristic's known miss (cut laps slower than best) is accepted only while cut detection is unavailable — when cut events arrive they close that gap authoritatively.

#### Scenario: Rejected would-be best
- **WHEN** a lap that never touched the pit lane completes with a time faster than the previous `bestLapMs` and `bestLapMs` keeps its previous value
- **THEN** the lap is recorded as invalid

#### Scenario: Clean new best
- **WHEN** a lap completes and `bestLapMs` updates to that lap's time
- **THEN** the lap is recorded as valid

#### Scenario: Lap through the pits
- **WHEN** `inPit` was true at any point during a lap and no cut event was attributed to it
- **THEN** that lap is recorded as a pit lap, not as invalid and not as valid

#### Scenario: Cut lap slower than best
- **WHEN** a cut event was received during a lap whose final time does not beat the session best
- **THEN** that lap is recorded as invalid (previously the accepted heuristic miss)

#### Scenario: Cut arrives while the record is pending
- **WHEN** a cut event referencing the just-completed lap arrives while that lap's record is held pending a fresh `lastLapMs`
- **THEN** the recorded lap is marked invalid

#### Scenario: Cut just after crossing the line
- **WHEN** a cut event stamped with the new lap's counter arrives before the dashboard's throttled lap state has seen that lap begin
- **THEN** the cut is held until the lap state catches up, the Current-lap tile then shows the INV cue, and the new lap is recorded as invalid when it completes

### Requirement: Validity-aware best-lap display
The Best-lap tile SHALL show the game's `bestLapMs` unless the session lap log knows that exact time belongs to a lap it did not mark valid — an invalidated lap (the game adopts cut laps as best in some session types) or a pit lap. In that case the tile SHALL show the fastest valid recorded lap instead, or the placeholder when no valid lap exists yet. While the lap just completed has not yet been given its status in the lap log, the tile SHALL keep the game's `bestLapMs` from before that lap completed, so a lap later found not valid never appears as best, even for a frame. Everywhere the dashboard presents a "best"/"fastest" lap derived from the lap log (analysis panel session best, best-sector baselines, sector owners, reference lap), only laps the log has marked valid SHALL qualify; a lap with no status yet SHALL NOT qualify.

#### Scenario: Game adopts a cut lap as best
- **WHEN** `bestLapMs` equals the time of a lap the log marked invalid and a slower valid lap exists
- **THEN** the Best-lap tile shows the valid lap's time

#### Scenario: Game adopts an out-lap as best
- **WHEN** `bestLapMs` equals the time of a lap the log recorded as an `out` lap and no valid lap exists
- **THEN** the Best-lap tile shows the placeholder

#### Scenario: No valid lap yet
- **WHEN** `bestLapMs` equals an invalidated lap's time and no valid lap has been recorded
- **THEN** the Best-lap tile shows the placeholder

#### Scenario: Game best predates the page
- **WHEN** `bestLapMs` matches no recorded lap (set before the dashboard connected)
- **THEN** the tile shows `bestLapMs` unchanged (its validity is unknown, the game is trusted)

#### Scenario: Crossing the line on an invalid lap
- **WHEN** the game adopts a just-completed lap as `bestLapMs` before the lap log has recorded that lap as invalid
- **THEN** the Best-lap tile keeps showing its previous value until the verdict lands, and never shows the invalid lap's time

#### Scenario: Recording stored before its verdict
- **WHEN** a just-completed lap's recording is stored before the lap log has given that lap a status, and the lap is faster than the session's valid laps
- **THEN** the analysis panel's reference, theoretical best and sector owners, and the track map's sector owners, ignore that recording until the lap is recorded valid
