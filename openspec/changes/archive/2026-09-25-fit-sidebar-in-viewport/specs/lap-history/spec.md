## RENAMED Requirements

- FROM: `### Requirement: Hover-revealed lap list on the Lap tile`
- TO: `### Requirement: Hover-revealed lap list on the completed-lap tiles`

## MODIFIED Requirements

### Requirement: Hover-revealed lap list on the completed-lap tiles
Hovering either the Last-lap tile or the Best-lap tile SHALL reveal a panel listing every recorded lap with its number and formatted time (tabular numerals). Invalid laps SHALL render their time in the critical/red color; the fastest valid lap SHALL render in the best-lap accent color. The panel SHALL scroll vertically when the list outgrows its maximum height, SHALL stay open while the pointer moves between the two tiles or onto the panel itself, SHALL disappear when the pointer leaves all of them, and SHALL require no click, keyboard, or window focus to open, scroll, or close. When no laps are recorded yet, the panel SHALL state that instead of rendering empty. The Current-lap and Delta tiles SHALL NOT open the panel.

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
- **THEN** that lap's time renders in the critical/red color

#### Scenario: Long session scrolls
- **WHEN** more laps are recorded than fit the panel's maximum height
- **THEN** the list scrolls with the mouse wheel while hovering, without clicking

#### Scenario: No laps yet
- **WHEN** the panel is opened before any lap has completed
- **THEN** it shows an empty-state message (e.g. "No laps completed yet")

## ADDED Requirements

### Requirement: Current-lap tile names the lap in progress
The Current-lap tile's label SHALL show the number of the lap in progress (existing display convention: lapCount N is "Lap N+1", e.g. "Lap 3") in place of a separate Lap counter tile, and SHALL show a placeholder number when no telemetry frame has been received. The live INV mark SHALL continue to appear beside that label when the in-progress lap is invalidated.

#### Scenario: Lap number in the label
- **WHEN** telemetry reports `lapCount` 2
- **THEN** the Current-lap tile's label reads "Lap 3" above the running lap time

#### Scenario: Invalidated lap in progress
- **WHEN** the in-progress lap receives a cut event
- **THEN** the label reads "Lap N" followed by the INV mark, and the time renders in the critical color

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** the label shows a placeholder lap number without errors
