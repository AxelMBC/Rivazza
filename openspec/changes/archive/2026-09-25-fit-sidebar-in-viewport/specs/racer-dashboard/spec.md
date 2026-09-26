## REMOVED Requirements

### Requirement: Pedal trace history
**Reason**: At the sidebar width a 12-second time series gets ~16 px per second in a tall box and reads as a barcode, and it duplicates what the dashboard already shows better: the live driving line colors throttle / coast / brake at every track position of the current lap, and the lap-analysis panel plots throttle and brake per position for every complete lap, comparable across laps and with exact percentages on hover.
**Migration**: Instantaneous pedal position is shown by the live pedal bars (see "Live pedal bars"); pedal history per position lives on the track map's driving line and in the lap-analysis traces. Clutch is no longer displayed.

## ADDED Requirements

### Requirement: Live pedal bars
The dashboard SHALL show the current throttle (`gas`) and brake (`brake`) inputs as two thin vertical bars beside the G-force meter, each filling from the bottom in proportion to its 0–100% value, throttle in the positive color and brake in the critical color (the driving-line convention), each labeled and with its current value as a whole percentage in tabular numerals. The bars SHALL update with the throttled telemetry state and SHALL span the supporting card's height at every card size.

#### Scenario: Trail braking
- **WHEN** telemetry reports `brake` 0.6 and `gas` 0.15
- **THEN** the brake bar fills to 60% of its height reading "60", and the throttle bar fills to 15% reading "15"

#### Scenario: Off the pedals
- **WHEN** both inputs are zero
- **THEN** both bars are empty and read "0"

#### Scenario: No telemetry
- **WHEN** no telemetry frame has been received
- **THEN** both bars render empty with a placeholder value, without errors

## MODIFIED Requirements

### Requirement: Motorsport visual restyle
The dashboard layout SHALL be reorganized into a dense, race-engineering style: instrument cluster and lap timing prominent, track map dominant, G-meter / live pedal bars / steering as supporting panels, using the existing dark theme tokens with tabular numerals for all timing and numeric readouts. The pre-session waiting screen behavior SHALL remain unchanged.

On the desktop layout (at and above the large breakpoint) the sidebar SHALL be arranged, top to bottom, as: the instrument cluster, with the steering indicator sharing the status-light row; the lap-timing tiles; and a single supporting card holding the G-force meter with the live pedal bars beside it. The supporting card SHALL be the sidebar's only element whose height follows the available space — it fills what the fixed-height elements leave, and the meter and bars resize with it — so the sidebar never needs to scroll. The G-force meter SHALL stay square (a circle of rings, never an ellipse) at every card size. Below the large breakpoint the stacked layout MAY scroll as before.

#### Scenario: Session active
- **WHEN** a session is connected and telemetry is flowing
- **THEN** the dashboard shows cluster, status lights, steering indicator, lap times with delta, G-meter, live pedal bars, and the gradient track map in a single non-scrolling viewport

#### Scenario: Desktop and laptop viewports fit without scrolling
- **WHEN** the dashboard renders with a session active at any viewport from 1366×650 up to 1920×1080 CSS pixels
- **THEN** the sidebar's content height does not exceed its visible height — no sidebar scrollbar appears and every card, including the full G-force meter, is visible

#### Scenario: Supporting card absorbs the leftover height
- **WHEN** the viewport height changes between those sizes
- **THEN** only the G-force / pedal-bar card changes height; the cluster and timing tiles keep their size, and the G-force meter remains circular

#### Scenario: Waiting for the sim
- **WHEN** no session is active
- **THEN** the existing waiting screen is shown as before

### Requirement: Information reveals are focus-safe
In any build that can drive a live session, any dashboard interaction that reveals additional information SHALL be driven exclusively by pointer hover or wheel scroll — never by click, keyboard input, or window focus — so the reveal works while Assetto Corsa holds input focus and clicking the browser would steal control inputs from the game.

A demo-replay build has no live session and no game to protect (see `demo-replay`), and SHALL instead drive its controls by click. Even there, no information SHALL be reachable only through a keyboard shortcut or a focused element.

#### Scenario: Reveal while the game has focus
- **WHEN** the browser window is unfocused in a live build and the pointer hovers a reveal trigger (Last-lap or Best-lap tile, instrument cluster, track-map lap line)
- **THEN** the associated information appears without requiring a click or focusing the window

#### Scenario: No click-gated information
- **WHEN** reviewing a live build's interactive surfaces
- **THEN** no information is reachable only through a click, keyboard shortcut, or focused element

#### Scenario: No keyboard-gated information in either mode
- **WHEN** reviewing a demo build's interactive surfaces
- **THEN** every reveal is reachable by pointer alone, with no keyboard shortcut or focused element required
