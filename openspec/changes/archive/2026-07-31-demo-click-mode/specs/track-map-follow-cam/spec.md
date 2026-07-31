## MODIFIED Requirements

### Requirement: Follow button armed by a 1-second hover dwell
The track map SHALL display a follow-mode button overlaid on the map whenever a live telemetry frame exists. In a build that can drive a live session, resting the cursor on the button for 1 continuous second SHALL activate follow mode. The button SHALL show a visible progress indicator during the dwell, and moving the cursor off the button before the dwell completes SHALL cancel the activation and reset the progress. Activation SHALL require no click, drag, keyboard input, or browser-window focus.

In a click-mode build (see `demo-replay`) the dwell SHALL NOT arm at all: a single click activates follow mode, the progress indicator never fills, and any length of hover leaves the button inert. The button's tooltip SHALL describe whichever gesture the build actually accepts.

#### Scenario: Dwell completes
- **WHEN** the cursor rests on the follow button for 1 second in a live build
- **THEN** follow mode activates without any click

#### Scenario: Dwell abandoned
- **WHEN** the cursor leaves the follow button after half a second in a live build
- **THEN** follow mode does not activate and the progress indicator resets

#### Scenario: No car to follow
- **WHEN** no telemetry frame has been received (bridge waiting for the game)
- **THEN** the follow button is not shown

#### Scenario: Click-mode activation
- **WHEN** a viewer clicks the follow button in a click-mode build
- **THEN** follow mode activates immediately and no progress indicator is shown

#### Scenario: Hover is inert in click mode
- **WHEN** the cursor rests on the follow button for 2 seconds in a click-mode build
- **THEN** follow mode does not activate and the progress indicator stays empty

### Requirement: Exit button returns to the normal view with a zoom-out effect
While follow mode is active (tracking, or detached by a touch pan), an exit button SHALL be shown in place of the follow button. In a build that can drive a live session, resting the cursor on it for 1 continuous second — same dwell, progress indicator, and cancel-on-leave behavior as the follow button — SHALL trigger a smooth animated zoom-out that ends exactly at the default 1× fit framing, after which the exit button is dismissed and the follow button returns. In a click-mode build a single click on the exit button SHALL trigger the same animated exit, with no dwell. The exit button SHALL be the only control on the follow overlay; zoom while tracking is driven by the wheel and pinch alone, in both interaction modes.

#### Scenario: Exiting follow mode
- **WHEN** the cursor rests on the exit button for 1 second during follow mode in a live build
- **THEN** the view animates out to exactly the fit view and the exit button disappears

#### Scenario: Exit dwell abandoned
- **WHEN** the cursor leaves the exit button before 1 second in a live build
- **THEN** the view keeps following the car uninterrupted

#### Scenario: No zoom controls on the overlay
- **WHEN** the view is tracking the car
- **THEN** the overlay shows the exit button alone, with no zoom-step buttons beside it

#### Scenario: Exit by click
- **WHEN** a viewer clicks the exit button in a click-mode build
- **THEN** the same animated exit runs, ending exactly at the fit view, and the follow button returns
