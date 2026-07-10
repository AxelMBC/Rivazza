# lap-history

## Purpose

Session-scoped lap history accumulated from the telemetry stream, with heuristic validity and hover-revealed displays.

## Requirements

### Requirement: Session lap log accumulates from the telemetry stream
The web app SHALL accumulate a session-scoped lap log from the telemetry stream: whenever `lapCount` increments, a record `{ lap, timeMs, invalid }` SHALL be appended, where `lap` follows the existing display convention (lapCount N completes "Lap N+1") and `timeMs` is the completed lap's `lastLapMs`. A record SHALL never be appended with a zero or stale time — if the frame that increments `lapCount` still carries the previous lap's `lastLapMs`, the hook SHALL wait for the refreshed value. The log SHALL reset when the session changes and when a session restart is detected (lap counter decreasing, or the current lap time running backwards within the same lap — the same signature the track map uses).

#### Scenario: Lap completes
- **WHEN** `lapCount` increases from 2 to 3 and `lastLapMs` reports 102118
- **THEN** the log gains a record for Lap 3 with time 102118

#### Scenario: Session restarted
- **WHEN** telemetry shows `lapCount` lower than the previously seen value
- **THEN** the lap log is cleared and accumulation starts over

#### Scenario: Page opened mid-session
- **WHEN** the dashboard connects while the driver is on lap 5
- **THEN** the log contains only laps completed after connecting (laps 1–4 are absent, not fabricated)

### Requirement: Heuristic lap invalidity
A recorded lap SHALL be marked `invalid` when any of: (a) its time beat the `bestLapMs` in effect before the lap completed but `bestLapMs` did not adopt it, (b) `inPit` was true on any frame during that lap, or (c) a cut event (from the bridge's shared-memory cut detection) was received during that lap — matched by lap counter, including a cut that arrives while the completed lap's record is still pending its refreshed time. When no prior best exists, a completed lap that leaves `bestLapMs` unset SHALL also be marked invalid. Laps not matching these conditions SHALL be marked valid. The heuristic's known miss (cut laps slower than best) is accepted only while cut detection is unavailable — when cut events arrive they close that gap authoritatively.

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

### Requirement: Hover-revealed lap list on the Lap tile
Hovering the Lap counter tile SHALL reveal a panel listing every recorded lap with its number and formatted time (tabular numerals). Invalid laps SHALL render their time in the critical/red color; the fastest valid lap SHALL render in the best-lap accent color. The panel SHALL scroll vertically when the list outgrows its maximum height, SHALL disappear when the pointer leaves, and SHALL require no click, keyboard, or window focus to open, scroll, or close. When no laps are recorded yet, the panel SHALL state that instead of rendering empty.

#### Scenario: Reveal on hover without focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over the Lap tile
- **THEN** the lap list panel appears, and it disappears when the pointer leaves the tile

#### Scenario: Invalid lap rendered in red
- **WHEN** the panel is open and the log contains an invalid lap
- **THEN** that lap's time renders in the critical/red color

#### Scenario: Long session scrolls
- **WHEN** more laps are recorded than fit the panel's maximum height
- **THEN** the list scrolls with the mouse wheel while hovering, without clicking

#### Scenario: No laps yet
- **WHEN** the panel is opened before any lap has completed
- **THEN** it shows an empty-state message (e.g. "No laps completed yet")

### Requirement: Track-map hover label includes lap time and validity
The existing track-map lap-line hover label SHALL be extended to show the hovered lap's recorded time next to the lap number, rendered in the critical/red color when the lap is invalid. When the hovered lap has no record in the log (e.g. driven before the page connected), the label SHALL fall back to the current lap-number-only form.

#### Scenario: Hovering a recorded lap line
- **WHEN** the cursor hovers a stored lap line whose lap has a record with time 102118
- **THEN** the label reads "Lap N — 1:42.118" (formatted per the existing lap-time formatter)

#### Scenario: Hovering an invalid lap line
- **WHEN** the hovered lap's record is marked invalid
- **THEN** the time portion of the label renders in the critical/red color

#### Scenario: Hovering an unrecorded lap line
- **WHEN** the hovered lap has no entry in the lap log
- **THEN** the label shows only "Lap N" as today

### Requirement: Live invalid state for the in-progress lap
The lap log SHALL expose whether the in-progress lap has received a cut event, and the Current-lap tile SHALL indicate it live: while the state is set, the tile renders its time in the critical color with a small "INV" mark (the lap list's existing chip styling). The state SHALL reset when a new lap starts, when the session restarts, and when the session changes.

#### Scenario: Lap dies mid-corner
- **WHEN** a cut event for the current lap arrives while the lap is in progress
- **THEN** the Current-lap tile switches to the critical/invalid presentation within a state update

#### Scenario: Crossing the line resets the cue
- **WHEN** the invalidated lap completes and a new lap begins
- **THEN** the Current-lap tile returns to its normal presentation

#### Scenario: Restart resets the cue
- **WHEN** a session restart is detected while the cue is showing
- **THEN** the cue clears with the rest of the lap log

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
