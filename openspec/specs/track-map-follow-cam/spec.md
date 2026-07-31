# track-map-follow-cam

## Purpose
TBD - created by syncing change track-map-follow-cam. Update Purpose after review.

## Requirements

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

### Requirement: Follow view tracks the car at a comfortable zoom
On activation, the view SHALL animate smoothly (eased, no snapping) from its current framing to a car-centered framing at a comfortable zoom, defined as a fixed world window of approximately 250 m across the smaller canvas dimension, clamped to the existing zoom bounds. While following, the view SHALL keep the car at the canvas center — not merely near it — with no drift that grows with the car's speed or with how tightly the view is zoomed, camera-like, with the map orientation fixed north-up (no rotation). Camera motion SHALL remain smooth at all framings. Follow SHALL work in all three projection modes (map metadata, edges-only, fallback driven-line), and lap-line stroke widths, the car dot radius, and hover interactions SHALL behave exactly as at an equivalent manual zoom level.

#### Scenario: Entering follow mode
- **WHEN** follow mode activates while the map is at the fit view
- **THEN** the view zooms in smoothly onto the car rather than jumping

#### Scenario: Car drives while following
- **WHEN** the car drives around the track in follow mode
- **THEN** the view pans to keep the car at the center, trailing it smoothly, and the map never rotates

#### Scenario: Fast car at a tight framing
- **WHEN** the view is zoomed to its tightest follow framing and the car is at racing speed
- **THEN** the car stays at the canvas center and never leaves the visible area

#### Scenario: Fallback-mode track
- **WHEN** the current track has no map.ini and no edges and follow mode activates
- **THEN** the car is tracked over the driven-line rendering identically to the other modes

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

### Requirement: Wheel zoom retargets the follow camera while tracking
Wheel input over the map during follow tracking SHALL change the follow camera's target framing — the world window it keeps around the car — and SHALL NOT hand the view to manual zoom. Tracking SHALL continue uninterrupted: the view SHALL glide to the new framing with the same eased motion used elsewhere in follow mode (no snapping), SHALL stay centered on the car throughout, and follow mode SHALL remain in the tracking state. The retarget SHALL be car-centered — the cursor's position SHALL NOT influence the framing while tracking, unlike cursor-anchored free zoom — and one wheel notch SHALL change the framing by the same proportion a notch changes free zoom, so the gesture feels identical in both modes. Retargeting SHALL work in all three projection modes, and lap-line stroke widths, the car dot radius, and hover interactions SHALL behave exactly as at an equivalent manual zoom level. Wheel events over the canvas SHALL NOT scroll the page.

#### Scenario: Scrolling in while tracking
- **WHEN** the user scrolls the wheel forward while the view is tracking the car
- **THEN** the view zooms in smoothly around the car, keeps tracking it, and the exit button remains

#### Scenario: Wheel does not detach
- **WHEN** the user scrolls the wheel during tracking
- **THEN** follow mode stays in the tracking state and the view does not hand off to manual zoom

#### Scenario: Cursor position is ignored
- **WHEN** the cursor hovers a corner far from the car and the wheel scrolls forward while tracking
- **THEN** the car stays at the canvas center and the view does not shift toward the cursor

#### Scenario: Notches accumulate
- **WHEN** the user scrolls in several notches in succession
- **THEN** each notch frames the car more tightly than the previous one

#### Scenario: Retargeting in a fallback-mode track
- **WHEN** the current track has no map.ini and no edges and the wheel scrolls during tracking
- **THEN** the framing changes over the driven-line rendering identically to the other modes

#### Scenario: Hover readout survives the retarget
- **WHEN** the cursor rests on a lap line and the wheel scrolls during tracking
- **THEN** the framing changes and the hover readout continues to pick lines at the new framing

### Requirement: Follow framing clamps at the tight end
Retargeting the follow camera inward SHALL be clamped so the framing stays within the map's existing maximum zoom, and SHALL additionally stop at a floor that keeps a usable amount of track in view — a fixed world window of approximately 100 m across the smaller canvas dimension, whichever is wider. Below roughly that window the canvas holds little but the car and the line it has just driven, with the corner ahead off-screen. Reaching either limit SHALL leave follow mode tracking — a retarget SHALL NOT end follow mode at the tight end. Repeated input against the limit SHALL NOT accumulate, so a single notch in the opposite direction SHALL visibly widen the framing.

#### Scenario: Scrolling in past the limit
- **WHEN** the user keeps scrolling in past the tightest framing while tracking
- **THEN** the framing stops changing, the view keeps tracking the car, and follow mode stays active

#### Scenario: Track stays in view at the tightest framing
- **WHEN** the user scrolls all the way in on a large track
- **THEN** the view still shows track around the car rather than only the car and its own trail

#### Scenario: Limits do not accumulate
- **WHEN** the user scrolls in five notches at the tightest framing and then scrolls out one notch
- **THEN** the framing visibly widens by one notch

### Requirement: Scrolling out past the widest follow framing leaves follow mode
The follow framing SHALL have a widest bound that keeps the view zoomed in strictly beyond the 1× fit framing, so a car-centered view at 1× — which would contradict the fit-view framing that 1× denotes — is never produced. Wheel or pinch input that would widen the framing past that bound SHALL NOT dead-stop: it SHALL end follow mode and trigger the same smooth animated return that the exit button performs, ending exactly at the default 1× fit framing, after which the exit button is dismissed and the follow button returns. Zoom therefore reads as one continuous axis from the tightest follow framing out to the fit view.

#### Scenario: Scrolling out of follow mode
- **WHEN** the user keeps scrolling out while tracking, past the widest follow framing
- **THEN** follow mode ends and the view animates out to exactly the fit framing

#### Scenario: The wide bound is never rendered as a car-centered 1×
- **WHEN** the user scrolls out to the widest framing follow mode allows
- **THEN** the view is still zoomed in beyond the fit framing and remains centered on the car

#### Scenario: Scrolling back in resumes tracking
- **WHEN** the user scrolls in while the view is animating out after scrolling past the wide bound
- **THEN** follow mode resumes tracking the car from the widest framing instead of continuing to exit

#### Scenario: Scrolling further out during the animation
- **WHEN** the user keeps scrolling out while the view is animating back to the fit view
- **THEN** the animation continues undisturbed to the fit framing

#### Scenario: Small track
- **WHEN** the track is small enough that its whole extent fits well inside the default follow window and the user scrolls out repeatedly
- **THEN** the view never renders a car-centered 1× framing; it leaves follow mode and lands on the fit view

### Requirement: Follow mode resets with the session
Follow mode (tracking, detached, or mid-animation) SHALL end and the view SHALL reset to the 1× fit framing when the session changes or a session restart is detected, together with the existing lap-line and zoom reset. Any wheel or pinch adjustment to the follow framing SHALL be discarded at the same time, so the next follow activation starts from the default comfortable zoom. Follow mode SHALL NOT end on lap completion, and lap completion SHALL NOT discard a framing adjustment.

#### Scenario: Restart while following
- **WHEN** the user restarts the session in game during follow mode
- **THEN** the map returns to the fit view, follow mode ends, and the follow button is shown again

#### Scenario: Lap completes while following
- **WHEN** a lap completes during follow mode
- **THEN** tracking continues uninterrupted and the finished lap's line appears in place

#### Scenario: Adjusted framing discarded on restart
- **WHEN** the user has scrolled the follow framing in and then restarts the session, and later re-activates follow mode
- **THEN** the camera frames the car at the default comfortable zoom, not the adjusted one

#### Scenario: Adjusted framing survives a lap
- **WHEN** the user has scrolled the follow framing in and a lap completes
- **THEN** the camera keeps that framing and continues tracking

### Requirement: Follow animation preserves render idling
Follow-mode camera animation SHALL only mark frames dirty while the camera is actually moving. Once the camera has settled on a stationary car and no other watched input changes, the map SHALL stop repainting exactly as it idles today.

#### Scenario: Game paused while following
- **WHEN** the game is paused mid-follow and the camera has settled on the car
- **THEN** the map stops repainting until telemetry or interaction resumes

### Requirement: Tap toggles follow mode on touch
On touch devices, a tap on the follow button SHALL activate follow mode immediately, and a tap on the exit button SHALL trigger the animated zoom-out to the fit view immediately — no dwell, no press-and-hold. The 1-second hover dwell SHALL remain the activation mechanism for mouse pointers only. A tap SHALL NOT leave the button in a state where the opposite action is blocked (the mouse-path re-arm guard SHALL NOT apply to touch activations), and the compatibility mouse events a browser synthesizes after a tap SHALL NOT start a phantom dwell or re-toggle the state.

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
- **THEN** the hover dwell with progress indicator behaves exactly as it does for a mouse-only device

### Requirement: Touch gestures detach tracking in place
A one-finger pan gesture on the map during follow tracking (or during the exit animation) SHALL stop the tracking immediately and hand the view to manual touch zoom/pan, seeded from the follow transform at that instant (no jump) — follow mode has no pan concept of its own, so a drag means the user wants to look elsewhere. A two-finger pinch SHALL NOT detach; it retargets the follow camera instead. In the detached state the exit button SHALL remain available, and pinching fully out to 1× SHALL reset to the fit framing and end follow mode.

#### Scenario: Pan during tracking
- **WHEN** the user drags one finger across the canvas while the view is tracking the car
- **THEN** tracking stops without a jump, the view pans with the finger, and the exit button stays visible

#### Scenario: Pinch during tracking does not detach
- **WHEN** the user pinches while the view is tracking the car
- **THEN** tracking continues and the pinch resizes the follow framing

#### Scenario: Pinching fully out while detached
- **WHEN** the user in the detached state pinches out until zoom reaches 1×
- **THEN** the map shows the default fit framing and the exit button is dismissed

### Requirement: Pinch retargets the follow camera while tracking
On touch devices, a two-finger pinch during follow tracking SHALL retarget the follow camera exactly as wheel input does — resizing the world window kept around the car, keeping tracking active, and staying centered on the car. Movement of the pinch midpoint SHALL NOT pan the view while tracking, since the camera owns the centering. Pinching out past the widest follow framing SHALL end follow mode and trigger the animated return to the 1× fit framing, the same rule as the wheel.

#### Scenario: Pinching in while tracking
- **WHEN** the user pinches out with two fingers (zoom in) while the view is tracking the car
- **THEN** the framing tightens around the car, tracking continues, and the exit button remains

#### Scenario: Midpoint drift does not pan
- **WHEN** the user pinches and drags both fingers across the canvas together while tracking
- **THEN** the framing changes with the pinch but the car stays centered

#### Scenario: Pinching out of follow mode
- **WHEN** the user pinches in (zoom out) past the widest follow framing while tracking
- **THEN** follow mode ends and the view animates out to exactly the fit framing

### Requirement: Follow retargeting preserves render idling
Retargeting the follow camera SHALL only mark frames dirty while the camera is actually moving toward the new framing. A retarget SHALL take effect even when nothing else about the frame has changed (stationary car, no new telemetry, parked cursor). Once the camera has settled at the new framing and no other watched input changes, the map SHALL stop repainting exactly as it idles today.

#### Scenario: Retarget with the game paused
- **WHEN** the game is paused mid-follow and the wheel scrolls
- **THEN** the map repaints through the glide and then stops repainting once the camera settles

#### Scenario: Settled camera idles
- **WHEN** the camera has settled at a retargeted framing on a stationary car
- **THEN** the map stops repainting until telemetry or interaction resumes
