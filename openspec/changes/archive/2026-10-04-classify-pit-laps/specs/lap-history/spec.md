## ADDED Requirements

### Requirement: Pit laps are classified, not invalidated
A recorded lap on which `inPit` was true on any frame SHALL be recorded as a pit lap rather than as invalid: an `out` lap when `inPit` was true on the lap's first frame (the frame on which its lap began, or the first frame seen after connecting or after a session restart), otherwise an `in` lap. A pit lap SHALL never be marked valid, so it SHALL never qualify wherever only valid laps qualify. A cut event attributed to the lap SHALL take precedence over the pit classification, so a cut pit lap is recorded as invalid. The rejected-best heuristic SHALL NOT apply to a pit lap, because the pit lane, not a cut, explains why the game did not adopt it as best.

#### Scenario: Out-lap from a pit spawn
- **WHEN** the session begins with the car in the pit lane and the first lap completes cleanly
- **THEN** that lap is recorded as an `out` lap, not as invalid

#### Scenario: In-lap
- **WHEN** a lap begins on track and the car enters the pit lane before the lap completes
- **THEN** that lap is recorded as an `in` lap

#### Scenario: Lap after an in-lap
- **WHEN** the line is crossed inside the pit lane and the next lap begins with `inPit` true
- **THEN** that next lap, once completed, is recorded as an `out` lap

#### Scenario: Game declines an out-lap as best
- **WHEN** an out-lap completes with no prior best and `bestLapMs` stays unset
- **THEN** the lap is recorded as an `out` lap, not as invalid

#### Scenario: Cut on an out-lap
- **WHEN** a cut event is attributed to a lap that began in the pit lane
- **THEN** that lap is recorded as invalid

## MODIFIED Requirements

### Requirement: Session lap log accumulates from the telemetry stream
The web app SHALL accumulate a session-scoped lap log from the telemetry stream: whenever `lapCount` increments, a record `{ lap, timeMs, status }` SHALL be appended, where `lap` follows the existing display convention (lapCount N completes "Lap N+1"), `timeMs` is the completed lap's `lastLapMs`, and `status` is exactly one of valid, invalid, `out` or `in`. A record SHALL never be appended with a zero or stale time — if the frame that increments `lapCount` still carries the previous lap's `lastLapMs`, the hook SHALL wait for the refreshed value. The log SHALL reset when the session changes and when a session restart is detected (lap counter decreasing, or the current lap time running backwards within the same lap — the same signature the track map uses).

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
A recorded lap SHALL be marked `invalid` when either: (a) a cut event (from the bridge's shared-memory cut detection) was received during that lap — matched by lap counter, including a cut that arrives while the completed lap's record is still pending its refreshed time — or (b) it is not a pit lap and its time beat the `bestLapMs` in effect before the lap completed but `bestLapMs` did not adopt it. When no prior best exists, a completed lap that is not a pit lap and leaves `bestLapMs` unset SHALL also be marked invalid. A lap matching neither condition SHALL be recorded as a pit lap when `inPit` was true on any of its frames, and as valid otherwise. The heuristic's known miss (cut laps slower than best) is accepted only while cut detection is unavailable — when cut events arrive they close that gap authoritatively.

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

### Requirement: Hover-revealed lap list on the completed-lap tiles
Hovering either the Last-lap tile or the Best-lap tile SHALL reveal a panel listing every recorded lap with its number and formatted time (tabular numerals). Invalid laps SHALL render their time in the critical/red color with an `INV` tag beside the lap number. Pit laps SHALL render their time in the secondary text tone with an `OUT` or `IN` tag, in the same tone, beside the lap number. The fastest valid lap SHALL render in the best-lap accent color. The panel SHALL scroll vertically when the list outgrows its maximum height, SHALL stay open while the pointer moves between the two tiles or onto the panel itself, SHALL disappear when the pointer leaves all of them, and SHALL require no click, keyboard, or window focus to open, scroll, or close. When no laps are recorded yet, the panel SHALL state that instead of rendering empty. The Current-lap and Delta tiles SHALL NOT open the panel.

#### Scenario: Reveal on hover without focus
- **WHEN** the browser window is unfocused (the game has focus) and the pointer moves over the Last-lap or Best-lap tile
- **THEN** the lap list panel appears, and it disappears when the pointer leaves the tiles and the panel

#### Scenario: Moving between the two tiles
- **WHEN** the panel is open from hovering the Last-lap tile and the pointer moves across to the Best-lap tile
- **THEN** the panel stays open without flickering closed

#### Scenario: Live tiles do not open it
- **WHEN** the pointer hovers the Current-lap or Delta tile
- **THEN** the lap list panel stays hidden

#### Scenario: Invalid lap rendered in red
- **WHEN** the panel is open and the log contains an invalid lap
- **THEN** that lap's time renders in the critical/red color with an `INV` tag

#### Scenario: Out-lap rendered neutral
- **WHEN** the panel is open and the log contains an `out` lap
- **THEN** that lap shows an `OUT` tag and its time in the secondary text tone, with nothing in the critical color

#### Scenario: Long session scrolls
- **WHEN** more laps are recorded than fit the panel's maximum height
- **THEN** the list scrolls with the mouse wheel while hovering, without clicking

#### Scenario: No laps yet
- **WHEN** the panel is opened before any lap has completed
- **THEN** it shows an empty-state message (e.g. "No laps completed yet")

### Requirement: Track-map hover label includes lap time and validity
The existing track-map lap-line hover label SHALL be extended to show the hovered lap's recorded time next to the lap number, rendered in the critical/red color when the lap is invalid and in a subdued neutral tone when it is a pit lap. When the hovered lap has no record in the log (e.g. driven before the page connected), the label SHALL fall back to the current lap-number-only form.

#### Scenario: Hovering a recorded lap line
- **WHEN** the cursor hovers a stored lap line whose lap has a record with time 102118
- **THEN** the label reads "Lap N — 1:42.118" (formatted per the existing lap-time formatter)

#### Scenario: Hovering an invalid lap line
- **WHEN** the hovered lap's record is marked invalid
- **THEN** the time portion of the label renders in the critical/red color

#### Scenario: Hovering a pit lap line
- **WHEN** the hovered lap's record is an `out` or `in` lap
- **THEN** the time portion of the label renders in a subdued neutral tone, not in the critical color

#### Scenario: Hovering an unrecorded lap line
- **WHEN** the hovered lap has no entry in the lap log
- **THEN** the label shows only "Lap N" as today

### Requirement: Validity-aware best-lap display
The Best-lap tile SHALL show the game's `bestLapMs` unless the session lap log knows that exact time belongs to a lap it did not mark valid — an invalidated lap (the game adopts cut laps as best in some session types) or a pit lap. In that case the tile SHALL show the fastest valid recorded lap instead, or the placeholder when no valid lap exists yet. While the lap just completed has not yet been given its status in the lap log, the tile SHALL keep the game's `bestLapMs` from before that lap completed, so a lap later found not valid never appears as best, even for a frame. Everywhere the dashboard presents a "best"/"fastest" lap derived from the lap log (analysis panel session best, best-sector baselines, reference lap), only valid laps SHALL qualify.

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
