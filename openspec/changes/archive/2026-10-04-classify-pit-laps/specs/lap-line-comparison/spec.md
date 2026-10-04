## MODIFIED Requirements

### Requirement: On-map legend identifies colored laps
While at least one colored lap exists, the map panel SHALL show a legend listing each currently-colored lap: its color swatch, lap number, and recorded lap time from the session lap log (rendered in the critical/red color when the lap is invalid; a pit lap's time renders in the legend's neutral tone, with its `OUT` or `IN` tag beside the lap number in the same tone), ordered most recent first. Laps without a lap-log record (driven before the page connected) SHALL show their number without a time. The legend SHALL be purely informational and require no interaction of any kind.

#### Scenario: Legend after three laps
- **WHEN** laps 1–3 have completed with recorded times
- **THEN** the legend shows three swatch + "Lap N" + time rows matching the line colors, lap 3 first

#### Scenario: Invalid lap in the legend
- **WHEN** a colored lap's record is marked invalid
- **THEN** its time renders in the critical/red color

#### Scenario: Out-lap in the legend
- **WHEN** a colored lap's record is an `out` lap
- **THEN** its row shows an `OUT` tag and its time in the legend's neutral tone, with nothing in the critical color
