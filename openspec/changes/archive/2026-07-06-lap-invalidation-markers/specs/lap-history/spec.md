# lap-history (delta)

## MODIFIED Requirements

### Requirement: Heuristic lap invalidity
A recorded lap SHALL be marked `invalid` when any of: (a) its time beat the `bestLapMs`
in effect before the lap completed but `bestLapMs` did not adopt it, (b) `inPit` was
true on any frame during that lap, or (c) a cut event (from the bridge's shared-memory
cut detection) was received during that lap — matched by lap counter, including a cut
that arrives while the completed lap's record is still pending its refreshed time. When
no prior best exists, a completed lap that leaves `bestLapMs` unset SHALL also be
marked invalid. Laps not matching these conditions SHALL be marked valid. The
heuristic's known miss (cut laps slower than best) is accepted only while cut detection
is unavailable — when cut events arrive they close that gap authoritatively.

#### Scenario: Rejected would-be best
- **WHEN** a lap completes with a time faster than the previous `bestLapMs` and `bestLapMs` keeps its previous value
- **THEN** the lap is recorded as invalid

#### Scenario: Clean new best
- **WHEN** a lap completes and `bestLapMs` updates to that lap's time
- **THEN** the lap is recorded as valid

#### Scenario: Lap through the pits
- **WHEN** `inPit` was true at any point during a lap
- **THEN** that lap is recorded as invalid

#### Scenario: Cut lap slower than best
- **WHEN** a cut event was received during a lap whose final time does not beat the session best
- **THEN** that lap is recorded as invalid (previously the accepted heuristic miss)

#### Scenario: Cut arrives while the record is pending
- **WHEN** a cut event referencing the just-completed lap arrives while that lap's record is held pending a fresh `lastLapMs`
- **THEN** the recorded lap is marked invalid

## ADDED Requirements

### Requirement: Live invalid state for the in-progress lap
The lap log SHALL expose whether the in-progress lap has received a cut event, and the
Current-lap tile SHALL indicate it live: while the state is set, the tile renders its
time in the critical color with a small "INV" mark (the lap list's existing chip
styling). The state SHALL reset when a new lap starts, when the session restarts, and
when the session changes.

#### Scenario: Lap dies mid-corner
- **WHEN** a cut event for the current lap arrives while the lap is in progress
- **THEN** the Current-lap tile switches to the critical/invalid presentation within a state update

#### Scenario: Crossing the line resets the cue
- **WHEN** the invalidated lap completes and a new lap begins
- **THEN** the Current-lap tile returns to its normal presentation

#### Scenario: Restart resets the cue
- **WHEN** a session restart is detected while the cue is showing
- **THEN** the cue clears with the rest of the lap log
