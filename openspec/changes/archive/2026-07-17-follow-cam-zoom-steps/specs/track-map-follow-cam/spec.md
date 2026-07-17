## ADDED Requirements

### Requirement: Zoom-step buttons shown only while tracking
While follow mode is actively tracking the car (`following`), the track map SHALL display two zoom-step buttons overlaid on the map: one that steps the follow framing in and one that steps it out. The buttons SHALL NOT be shown when follow mode is off, when tracking has been detached by manual zoom, or during the exit animation. They SHALL be presented alongside the exit button without displacing it.

#### Scenario: Tracking the car
- **WHEN** follow mode is actively tracking the car
- **THEN** a zoom-in button and a zoom-out button are shown alongside the exit button

#### Scenario: Follow mode off
- **WHEN** follow mode is off and the follow button is shown
- **THEN** neither zoom-step button is shown

#### Scenario: Detached by the wheel
- **WHEN** the user scrolls the wheel during tracking and the view detaches
- **THEN** the zoom-step buttons disappear and only the exit button remains

#### Scenario: During the exit animation
- **WHEN** the exit dwell completes and the view is animating back to the fit view
- **THEN** the zoom-step buttons are not shown

### Requirement: Zoom step armed by a short hover dwell
Each zoom-step button SHALL be armed by a continuous hover dwell shorter than the follow button's 3-second dwell, and SHALL apply exactly one zoom step when the dwell completes. Each button SHALL show a visible progress indicator during its own dwell only, and moving the cursor off the button before the dwell completes SHALL cancel the step and reset the progress. After a step fires, a further step SHALL require the cursor to leave the button and return — a single dwell SHALL NOT repeat. Activation SHALL require no click, drag, keyboard input, or browser-window focus.

#### Scenario: Dwell completes
- **WHEN** the cursor rests on the zoom-in button for the dwell duration
- **THEN** the view steps in by one increment without any click

#### Scenario: Dwell abandoned
- **WHEN** the cursor leaves the zoom-in button before the dwell completes
- **THEN** no zoom step is applied and the progress indicator resets

#### Scenario: Single step per hover
- **WHEN** the cursor completes a dwell on the zoom-in button and then remains parked on it
- **THEN** exactly one step is applied and no further steps fire while the cursor stays

#### Scenario: Stepping again
- **WHEN** the cursor leaves the zoom-in button after a step and returns for another full dwell
- **THEN** a second step is applied

#### Scenario: Progress is per button
- **WHEN** the cursor dwells on the zoom-out button
- **THEN** only the zoom-out button shows dwell progress, and the exit and zoom-in buttons show none

### Requirement: Zoom steps retarget the camera without detaching
A zoom step SHALL change the follow camera's target framing — the world window it keeps around the car — and SHALL NOT hand the view to manual zoom. Tracking SHALL continue uninterrupted across a step: the view SHALL animate to the new framing with the same eased glide used elsewhere in follow mode (no snapping), SHALL remain centered on the car throughout, and follow mode SHALL remain in the tracking state. Steps SHALL work in all three projection modes, and lap-line stroke widths, the car dot radius, and hover interactions SHALL behave exactly as at an equivalent manual zoom level.

#### Scenario: Stepping in while tracking
- **WHEN** the cursor completes a dwell on the zoom-in button while the car is driving
- **THEN** the view zooms in smoothly, keeps tracking the car, and the exit button remains

#### Scenario: Stepping does not detach
- **WHEN** a zoom step is applied
- **THEN** follow mode stays in the tracking state and the view does not hand off to manual zoom

#### Scenario: Steps accumulate
- **WHEN** the user completes dwells on the zoom-in button three times in succession
- **THEN** each step zooms in further from the previous framing

#### Scenario: Stepping in a fallback-mode track
- **WHEN** the current track has no map.ini and no edges and a zoom step is applied
- **THEN** the framing changes over the driven-line rendering identically to the other modes

### Requirement: Zoom steps clamp at both ends
Zoom steps SHALL be clamped so the framing stays within the map's existing zoom bounds. Stepping in SHALL stop at the maximum zoom. Stepping out SHALL stop while the view is still zoomed in strictly beyond the 1× fit framing, so a car-centered view at 1× — which would contradict the fit-view framing that 1× denotes — is never produced. Reaching either limit SHALL leave follow mode tracking; a zoom step SHALL NOT end follow mode. Repeated steps against a limit SHALL NOT accumulate, so a single step in the opposite direction SHALL visibly move the framing.

#### Scenario: Stepping in past the limit
- **WHEN** the user keeps stepping in past the maximum zoom
- **THEN** the framing stops changing, the view keeps tracking the car, and follow mode stays active

#### Scenario: Stepping out to the floor
- **WHEN** the user keeps stepping out until the floor is reached
- **THEN** the view remains zoomed in beyond the fit framing, stays centered on the car, and follow mode does not end

#### Scenario: Limits do not accumulate
- **WHEN** the user steps out five times at the floor and then steps in once
- **THEN** the framing visibly zooms in by one step

#### Scenario: Floor holds on a small track
- **WHEN** the track is small enough that its whole extent fits well inside the default follow window and the user steps out repeatedly
- **THEN** the view still never reaches the 1×-with-car-centered framing

### Requirement: Zoom steps preserve render idling
Applying a zoom step SHALL only mark frames dirty while the camera is actually moving toward the new framing. Once the camera has settled at the stepped framing on a stationary car and no other watched input changes, the map SHALL stop repainting exactly as it idles today.

#### Scenario: Step with the game paused
- **WHEN** the game is paused mid-follow and a zoom step is applied
- **THEN** the map repaints through the glide and then stops repainting once the camera settles

### Requirement: Tap steps the zoom on touch
On touch devices, a tap on a zoom-step button SHALL apply one step immediately — no dwell, no press-and-hold. The hover dwell SHALL remain the arming mechanism for mouse pointers only. The compatibility mouse events a browser synthesizes after a tap SHALL NOT start a phantom dwell or apply a second step.

#### Scenario: Tap to step
- **WHEN** a touch user taps the zoom-in button
- **THEN** the view steps in once immediately and keeps tracking the car

#### Scenario: No phantom second step
- **WHEN** a touch user taps the zoom-in button and lifts their finger
- **THEN** exactly one step is applied, with no additional step from synthesized mouse events

#### Scenario: Repeated tapping
- **WHEN** a touch user taps the zoom-out button several times in succession
- **THEN** each tap applies one step until the floor is reached, with no stuck state

## MODIFIED Requirements

### Requirement: Manual wheel zoom cancels tracking in place
Any wheel input over the map during follow tracking SHALL stop the tracking immediately and hand the current view to the normal cursor-anchored manual zoom, seeded from the follow transform at that instant (no jump). In this detached state the exit button SHALL remain available for the animated return to the fit view, and scrolling fully out to 1× SHALL still reset to the fit framing, ending follow mode and dismissing the exit button. The zoom-step buttons SHALL NOT count as manual zoom input for this rule: a zoom step retargets the follow camera and leaves tracking active.

#### Scenario: Wheel during tracking
- **WHEN** the user scrolls the wheel while the view is tracking the car
- **THEN** tracking stops, the view zooms around the cursor from its current framing, and the exit button stays visible

#### Scenario: Scrolling fully out while detached
- **WHEN** the user in the detached state scrolls out until zoom reaches 1×
- **THEN** the map shows the default fit framing and the exit button is dismissed

#### Scenario: Zoom step is not manual zoom
- **WHEN** the user applies a zoom step while the view is tracking the car
- **THEN** tracking continues and the view does not enter the detached state

#### Scenario: Wheel after a zoom step
- **WHEN** the user applies a zoom step and then scrolls the wheel
- **THEN** tracking stops and manual zoom is seeded from the stepped framing with no jump

### Requirement: Follow mode resets with the session
Follow mode (tracking, detached, or mid-animation) SHALL end and the view SHALL reset to the 1× fit framing when the session changes or a session restart is detected, together with the existing lap-line and zoom reset. Any zoom-step adjustment to the follow framing SHALL be discarded at the same time, so the next follow activation starts from the default comfortable zoom. Follow mode SHALL NOT end on lap completion, and lap completion SHALL NOT discard a zoom-step adjustment.

#### Scenario: Restart while following
- **WHEN** the user restarts the session in game during follow mode
- **THEN** the map returns to the fit view, follow mode ends, and the follow button is shown again

#### Scenario: Lap completes while following
- **WHEN** a lap completes during follow mode
- **THEN** tracking continues uninterrupted and the finished lap's line appears in place

#### Scenario: Stepped zoom discarded on restart
- **WHEN** the user has stepped the follow zoom in and then restarts the session, and later re-activates follow mode
- **THEN** the camera frames the car at the default comfortable zoom, not the stepped one

#### Scenario: Stepped zoom survives a lap
- **WHEN** the user has stepped the follow zoom in and a lap completes
- **THEN** the camera keeps the stepped framing and continues tracking
