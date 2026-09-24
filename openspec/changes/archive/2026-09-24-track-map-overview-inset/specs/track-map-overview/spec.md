## ADDED Requirements

### Requirement: Overview inset appears while zoomed in and not tracking
The track map SHALL draw an overview inset, a miniature of the whole track at the 1× fit framing, in the map's top-right corner below the pedal legend. The inset SHALL be shown only when all of these hold: the view is zoomed in by at least two wheel notches (a zoom level of about 1.3× or more, the same threshold for pinch), the follow camera is not tracking the car (follow mode off or detached), and the map uses a fixed-fit projection (map metadata or track-edge bounds). It SHALL be hidden otherwise, including at 1× and after a single notch, while follow mode is tracking or exiting, and in the fallback driven-line mode, whose auto-fit view has no fixed overview to show. The inset SHALL keep the canvas's aspect ratio, SHALL NOT exceed roughly a fifth of the canvas width, and SHALL sit on an opaque panel-surface background with a subtle border so the main map does not show through it.

#### Scenario: Zooming past the threshold
- **WHEN** follow mode is off and the user wheel-zooms in by two notches from the fit view on a track with map metadata
- **THEN** the overview inset appears in the top-right corner below the pedal legend

#### Scenario: One notch in
- **WHEN** the user wheel-zooms in by a single notch from the fit view
- **THEN** no inset is drawn

#### Scenario: Tracking hides the inset
- **WHEN** the view is zoomed to 10× and follow mode starts tracking the car
- **THEN** the inset disappears for as long as the camera is tracking or exiting

#### Scenario: Detached follow shows the inset
- **WHEN** a touch pan has detached follow mode at a zoom of two notches or more
- **THEN** the inset is shown

#### Scenario: Fallback mode
- **WHEN** the track has neither map metadata nor track edges and the user zooms in two notches or more
- **THEN** no inset is drawn

### Requirement: Inset shows the track, the car, and the current view
The inset SHALL depict the track at the fit framing, scaled into the inset: the track-limits ribbon when edge data exists, otherwise the stored lap lines in a single neutral tone. It SHALL show the car's current position as a small dot, and SHALL outline the part of the track the main view currently shows as a rectangle that exactly corresponds to the main canvas's visible area at the current zoom and offset. It SHALL NOT render pedal colours, sector labels, cut markers, or hover readouts.

#### Scenario: Viewport rectangle tracks the main view
- **WHEN** the user wheel-zooms further in over a corner while the inset is visible
- **THEN** the inset's viewport rectangle shrinks around that corner and always outlines exactly what the main view shows

#### Scenario: Car dot on the inset
- **WHEN** the car drives out of the zoomed main view
- **THEN** its dot keeps moving on the inset, showing where it is relative to the viewport rectangle

### Requirement: Hovering the inset previews and navigates without a click
While the cursor is over the inset, a ghost rectangle, the same size on the inset as the viewport rectangle, SHALL be drawn centred on the cursor. When the cursor rests on the inset (stays within a few pixels) for about 250 ms, the main view SHALL glide smoothly (eased, no snapping) so that the track point under the cursor becomes the centre of the main view, at the unchanged zoom level. Moving and resting again SHALL navigate again, retargeting a glide already in progress. Passing the cursor across the inset without resting SHALL NOT move the main view. Navigation SHALL require no click, drag, keyboard input, or browser-window focus. A navigation in the detached follow state SHALL leave follow mode detached, with its exit button still available.

#### Scenario: Jump across the track at the same zoom
- **WHEN** the main view is zoomed to 12× on one corner and the cursor rests for about 250 ms on a corner at the far side of the inset
- **THEN** the main view glides to centre that far corner, still at 12×, and the viewport rectangle ends where the ghost rectangle was

#### Scenario: Sweeping through the inset
- **WHEN** the cursor moves across the inset on its way elsewhere without pausing
- **THEN** the ghost rectangle follows the cursor while it is inside, and the main view does not move

#### Scenario: Navigating with the game focused
- **WHEN** the browser window is unfocused (the game has focus) and the cursor rests on the inset
- **THEN** the main view navigates, and the game keeps receiving controller input

#### Scenario: Leaving the inset
- **WHEN** the cursor leaves the inset
- **THEN** the ghost rectangle disappears and any glide already committed completes

### Requirement: Wheel over the inset zooms around the view centre
Wheel input with the cursor over the inset SHALL zoom the main view with the same per-notch step and the same 1× to maximum bounds as wheel zoom on the map, anchored at the main view's centre rather than at the cursor's screen position. Wheel input over the inset SHALL NOT scroll the page. Zooming out below the two-notch threshold SHALL hide the inset per its visibility rule, after which wheel input over that area behaves as ordinary cursor-anchored map zoom.

#### Scenario: Zooming in from the inset
- **WHEN** the cursor is over the inset and the wheel scrolls forward
- **THEN** the main view magnifies around its current centre, and the viewport rectangle shrinks around its own centre

#### Scenario: Zooming out from the inset
- **WHEN** the cursor is over the inset and the wheel scrolls backward until the zoom falls below two notches in
- **THEN** the inset disappears and further scrolling zooms the map around the cursor as usual

### Requirement: Tap and click on the inset navigate immediately where allowed
On touch devices, a tap on the inset (a touch that ends within the tap slop) SHALL navigate the main view to the tapped point immediately, with the same glide and unchanged zoom. A touch gesture that starts on the inset SHALL NOT pan or pinch the main view. In a click-mode (demo) build, a mouse click on the inset SHALL navigate immediately with no dwell; hover SHALL still show the ghost rectangle. In a live build, clicks on the inset SHALL have no effect.

#### Scenario: Tapping the inset
- **WHEN** a touch user taps a point on the visible inset
- **THEN** the main view glides to centre that point at the unchanged zoom

#### Scenario: Clicking in a demo build
- **WHEN** a click-mode build's user clicks a point on the inset
- **THEN** the main view glides there at once, without waiting for a dwell

### Requirement: The inset is excluded from lap-line hover picking
While the cursor is over the visible inset, the map SHALL NOT pick lap lines under it: no hover readout, line emphasis, or ring marker SHALL appear because of main-map lines drawn beneath the inset, and the canvas cursor SHALL NOT change to the line-pick pointer there.

#### Scenario: Line beneath the inset
- **WHEN** a stored lap line on the main view passes under the inset and the cursor hovers the inset over it
- **THEN** no lap readout or emphasis appears, and only the ghost rectangle is drawn

### Requirement: Inset rendering preserves render idling
The inset's static content (track depiction at the fit framing) SHALL be cached and re-rendered only when its inputs change: canvas size or devicePixelRatio, projection mode or fit framing, track edges, or the stored lap lines it depicts. Showing the inset, moving the ghost rectangle, and gliding SHALL repaint the map only while something visible changes. When the glide settles, it SHALL snap to its exact target within a sub-pixel epsilon so the map stops repainting. A resting cursor with no pending navigation, a stationary car, and no new telemetry SHALL leave the map idle.

#### Scenario: Idle after navigating
- **WHEN** the telemetry stream is paused, the user rests on the inset, and the glide completes
- **THEN** the map stops repainting until the next input

#### Scenario: Paused and hovering
- **WHEN** telemetry is paused and the cursor rests on the inset after a navigation has already completed at that spot
- **THEN** no further repaints occur

### Requirement: Navigation state resets with the session
A pending dwell or an in-progress glide SHALL be discarded when the session changes or a session restart is detected, together with the existing zoom reset to the 1× fit view, after which the inset is hidden until the user zooms in two notches again.

#### Scenario: Restart mid-glide
- **WHEN** a glide is in progress and the user restarts the session in game
- **THEN** the map returns to the 1× fit view with no residual glide, and the inset is hidden
