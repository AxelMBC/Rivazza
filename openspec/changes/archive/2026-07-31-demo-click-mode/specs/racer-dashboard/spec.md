## ADDED Requirements

### Requirement: The active interaction mode is named in the header
The session header SHALL display the build's interaction model as a labeled indicator, reading "Click mode" when controls activate on click and "Hover mode" when they activate on hover or dwell. The indicator SHALL be present in every build, not only the exceptional one, because in a hover-mode build it is the only thing distinguishing "clicks do nothing by design" from a broken page. It SHALL carry an explanation of the mode reachable without interaction beyond hover.

#### Scenario: Hover-mode build
- **WHEN** the dashboard is a live build
- **THEN** the header shows "Hover mode" alongside the connection badge

#### Scenario: Click-mode build
- **WHEN** the dashboard is a demo-replay build
- **THEN** the header shows "Click mode" alongside the demo badge

## MODIFIED Requirements

### Requirement: Information reveals are focus-safe
In any build that can drive a live session, any dashboard interaction that reveals additional information SHALL be driven exclusively by pointer hover or wheel scroll — never by click, keyboard input, or window focus — so the reveal works while Assetto Corsa holds input focus and clicking the browser would steal control inputs from the game.

A demo-replay build has no live session and no game to protect (see `demo-replay`), and SHALL instead drive its controls by click. Even there, no information SHALL be reachable only through a keyboard shortcut or a focused element.

#### Scenario: Reveal while the game has focus
- **WHEN** the browser window is unfocused in a live build and the pointer hovers a reveal trigger (Lap tile, instrument cluster, track-map lap line)
- **THEN** the associated information appears without requiring a click or focusing the window

#### Scenario: No click-gated information
- **WHEN** reviewing a live build's interactive surfaces
- **THEN** no information is reachable only through a click, keyboard shortcut, or focused element

#### Scenario: No keyboard-gated information in either mode
- **WHEN** reviewing a demo build's interactive surfaces
- **THEN** every reveal is reachable by pointer alone, with no keyboard shortcut or focused element required
