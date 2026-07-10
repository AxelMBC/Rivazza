# track-map-follow-cam

## Purpose
TBD - created by syncing change track-map-follow-cam. Update Purpose after review.

## Requirements

### Requirement: Follow button armed by a 3-second hover dwell
The track map SHALL display a follow-mode button overlaid on the map whenever a live telemetry frame exists. Resting the cursor on the button for 3 continuous seconds SHALL activate follow mode. The button SHALL show a visible progress indicator during the dwell, and moving the cursor off the button before the dwell completes SHALL cancel the activation and reset the progress. Activation SHALL require no click, drag, keyboard input, or browser-window focus.

#### Scenario: Dwell completes
- **WHEN** the cursor rests on the follow button for 3 seconds
- **THEN** follow mode activates without any click

#### Scenario: Dwell abandoned
- **WHEN** the cursor leaves the follow button after 2 seconds
- **THEN** follow mode does not activate and the progress indicator resets

#### Scenario: No car to follow
- **WHEN** no telemetry frame has been received (bridge waiting for the game)
- **THEN** the follow button is not shown

### Requirement: Follow view tracks the car at a comfortable zoom
On activation, the view SHALL animate smoothly (eased, no snapping) from its current framing to a car-centered framing at a comfortable zoom, defined as a fixed world window of approximately 250 m across the smaller canvas dimension, clamped to the existing zoom bounds. While following, the view SHALL continuously pan with smoothing to keep the car near the canvas center, camera-like, with the map orientation fixed north-up (no rotation). Follow SHALL work in all three projection modes (map metadata, edges-only, fallback driven-line), and lap-line stroke widths, the car dot radius, and hover interactions SHALL behave exactly as at an equivalent manual zoom level.

#### Scenario: Entering follow mode
- **WHEN** follow mode activates while the map is at the fit view
- **THEN** the view zooms in smoothly onto the car rather than jumping

#### Scenario: Car drives while following
- **WHEN** the car drives around the track in follow mode
- **THEN** the view pans to keep the car near the center, trailing it smoothly, and the map never rotates

#### Scenario: Fallback-mode track
- **WHEN** the current track has no map.ini and no edges and follow mode activates
- **THEN** the car is tracked over the driven-line rendering identically to the other modes

### Requirement: Exit button returns to the normal view with a zoom-out effect
While follow mode is active (tracking or detached by manual zoom), an exit button SHALL be shown in place of the follow button. Resting the cursor on it for 3 continuous seconds — same dwell, progress indicator, and cancel-on-leave behavior as the follow button — SHALL trigger a smooth animated zoom-out that ends exactly at the default 1× fit framing, after which the exit button is dismissed and the follow button returns.

#### Scenario: Exiting follow mode
- **WHEN** the cursor rests on the exit button for 3 seconds during follow mode
- **THEN** the view animates out to exactly the fit view and the exit button disappears

#### Scenario: Exit dwell abandoned
- **WHEN** the cursor leaves the exit button before 3 seconds
- **THEN** the view keeps following the car uninterrupted

### Requirement: Manual wheel zoom cancels tracking in place
Any wheel input over the map during follow tracking SHALL stop the tracking immediately and hand the current view to the normal cursor-anchored manual zoom, seeded from the follow transform at that instant (no jump). In this detached state the exit button SHALL remain available for the animated return to the fit view, and scrolling fully out to 1× SHALL still reset to the fit framing, ending follow mode and dismissing the exit button.

#### Scenario: Wheel during tracking
- **WHEN** the user scrolls the wheel while the view is tracking the car
- **THEN** tracking stops, the view zooms around the cursor from its current framing, and the exit button stays visible

#### Scenario: Scrolling fully out while detached
- **WHEN** the user in the detached state scrolls out until zoom reaches 1×
- **THEN** the map shows the default fit framing and the exit button is dismissed

### Requirement: Follow mode resets with the session
Follow mode (tracking, detached, or mid-animation) SHALL end and the view SHALL reset to the 1× fit framing when the session changes or a session restart is detected, together with the existing lap-line and zoom reset. Follow mode SHALL NOT end on lap completion.

#### Scenario: Restart while following
- **WHEN** the user restarts the session in game during follow mode
- **THEN** the map returns to the fit view, follow mode ends, and the follow button is shown again

#### Scenario: Lap completes while following
- **WHEN** a lap completes during follow mode
- **THEN** tracking continues uninterrupted and the finished lap's line appears in place

### Requirement: Follow animation preserves render idling
Follow-mode camera animation SHALL only mark frames dirty while the camera is actually moving. Once the camera has settled on a stationary car and no other watched input changes, the map SHALL stop repainting exactly as it idles today.

#### Scenario: Game paused while following
- **WHEN** the game is paused mid-follow and the camera has settled on the car
- **THEN** the map stops repainting until telemetry or interaction resumes

### Requirement: Tap toggles follow mode on touch
On touch devices, a tap on the follow button SHALL activate follow mode immediately, and a tap on the exit button SHALL trigger the animated zoom-out to the fit view immediately — no dwell, no press-and-hold. The 3-second hover dwell SHALL remain the activation mechanism for mouse pointers only. A tap SHALL NOT leave the button in a state where the opposite action is blocked (the mouse-path re-arm guard SHALL NOT apply to touch activations), and the compatibility mouse events a browser synthesizes after a tap SHALL NOT start a phantom dwell or re-toggle the state.

#### Scenario: Tap to follow
- **WHEN** a touch user taps the "Follow car" button
- **THEN** follow mode activates immediately and the button becomes "Exit follow"

#### Scenario: Tap to exit — the reported bug
- **WHEN** follow mode is active (entered by tap) and the touch user taps "Exit follow"
- **THEN** the view animates back to the 1× fit framing and the follow button returns

#### Scenario: Repeated toggling
- **WHEN** a touch user taps the button several times in succession
- **THEN** each tap toggles between following and exiting with no stuck state

#### Scenario: Mouse dwell unaffected
- **WHEN** a mouse user hovers the follow button
- **THEN** the 3-second dwell with progress indicator behaves exactly as before

### Requirement: Touch gestures detach tracking in place
A pinch or pan gesture on the map during follow tracking (or during the exit animation) SHALL stop the tracking immediately and hand the view to manual touch zoom/pan, seeded from the follow transform at that instant — the same detach-in-place rule as wheel input. In the detached state the exit button SHALL remain available, and pinching fully out to 1× SHALL reset to the fit framing and end follow mode.

#### Scenario: Pinch during tracking
- **WHEN** the user pinches while the view is tracking the car
- **THEN** tracking stops without a jump, the pinch zooms from the current framing, and the exit button stays visible

#### Scenario: Pinching fully out while detached
- **WHEN** the user in the detached state pinches out until zoom reaches 1×
- **THEN** the map shows the default fit framing and the exit button is dismissed
