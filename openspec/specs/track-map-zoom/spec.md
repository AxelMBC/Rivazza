# track-map-zoom

## Purpose
TBD - created by syncing change improve-racing-line-comparison. Update Purpose after review.

## Requirements

### Requirement: Scroll-wheel zoom anchored at the cursor
The track map SHALL zoom in and out with the mouse wheel while the cursor hovers the map canvas, keeping the world point under the cursor fixed on screen as the zoom changes. Zoom SHALL step exponentially per wheel notch and SHALL be clamped between 1× (the existing fit-to-canvas framing) and an upper bound of at least 40×. Wheel events over the canvas SHALL NOT scroll the page.

#### Scenario: Zooming into a corner
- **WHEN** the cursor hovers a corner of the track and the wheel scrolls forward
- **THEN** the view magnifies around that corner and the point under the cursor stays under the cursor

#### Scenario: Zoom upper clamp
- **WHEN** the user keeps scrolling forward past the maximum zoom
- **THEN** the zoom stops at the maximum and the view no longer changes

### Requirement: Scrolling fully out restores the fit view
Zooming out to 1× SHALL restore exactly the default fit-to-canvas framing, discarding any accumulated zoom focus, so scrolling out is the reset gesture. No dedicated reset control SHALL be required.

#### Scenario: Return to full view
- **WHEN** the user scrolls backward until zoom reaches 1×
- **THEN** the map shows the same framing as before any zooming, with no residual offset

### Requirement: Zoom requires no click, keyboard, or window focus
All zoom interaction SHALL work with hover and scroll-wheel alone: no click, drag, double-click, keyboard, or browser-window focus is required at any point. This preserves controller input to the running game.

#### Scenario: Zooming with the game focused
- **WHEN** the browser window is unfocused (the game has focus) and the cursor hovers the map while the wheel scrolls
- **THEN** the map zooms, and the game continues to receive controller input

### Requirement: Zoom applies in every projection mode
The zoom transform SHALL compose over all three rendering modes — map image, bounds-only (map.ini without image), and fallback driven-line mode — magnifying the map image (when present), all lap lines, and the car dot together so they stay registered. Lap-line stroke widths, the car dot radius, and the hover pick radius SHALL remain constant in screen pixels regardless of zoom. Lap lines SHALL be re-projected from raw world-coordinate samples at every zoom level (never scaled as a raster), preserving full positional precision.

#### Scenario: Zoom on a bounds-only track
- **WHEN** the current track has map.ini bounds but no map.png and the user zooms in
- **THEN** the lap lines and car dot magnify around the cursor exactly as they would with an image

#### Scenario: Lines stay crisp at high zoom
- **WHEN** the view is at high zoom over a corner
- **THEN** lap lines render as sharp vector strokes of unchanged pixel width while only the background image (if any) may appear blurred

### Requirement: Zoom state resets with the session
The zoom level and focus SHALL reset to the 1× fit view when the session changes or a session restart is detected, together with the existing lap-line reset. Zoom SHALL NOT reset on lap completion.

#### Scenario: Session restart while zoomed
- **WHEN** the user is zoomed into a corner and restarts the session in game
- **THEN** the map returns to the full fit view as the lines clear

#### Scenario: Lap completes while zoomed
- **WHEN** a lap completes while the user is zoomed into a corner
- **THEN** the view stays where it is and the finished lap's line appears in place

### Requirement: Pinch-to-zoom anchored at the pinch midpoint
On touch devices, a two-finger pinch on the map canvas SHALL zoom the view, keeping the world point under the pinch midpoint fixed on screen as the zoom changes (movement of the midpoint during the gesture pans the view correspondingly). Pinch zoom SHALL respect the same bounds as wheel zoom — clamped between 1× (the fit-to-canvas framing) and the same upper bound — and SHALL compose over all projection modes with the same screen-pixel-constant stroke widths, dot radius, and pick radius as wheel zoom.

#### Scenario: Pinching into a corner
- **WHEN** two fingers spread apart over a corner of the track
- **THEN** the view magnifies around the pinch midpoint and the track point between the fingers stays between the fingers

#### Scenario: Pinch upper clamp
- **WHEN** the user keeps spreading past the maximum zoom
- **THEN** the zoom stops at the maximum

#### Scenario: Moving pinch pans
- **WHEN** the user pinches and drags both fingers across the canvas together
- **THEN** the view zooms and pans following the midpoint, platform-map style

### Requirement: Pinching fully out restores the fit view
Pinching out until the zoom reaches 1× SHALL restore exactly the default fit-to-canvas framing, discarding any accumulated offset — the same reset semantics as scrolling fully out. Gestures ending within a small epsilon above 1× SHALL snap to the exact fit framing rather than leaving a residual sub-pixel offset.

#### Scenario: Pinch out to reset
- **WHEN** the user pinches out until the zoom reaches the minimum
- **THEN** the map shows the same framing as before any zooming, with no residual offset

### Requirement: One-finger drag pans while zoomed
On touch devices, while the zoom level is above 1×, a single-finger drag on the map canvas SHALL pan the view by the drag delta. At exactly 1× (fit view), a single-finger drag SHALL NOT move the view, so taps and incidental touches leave the fit framing stable.

#### Scenario: Panning a zoomed view
- **WHEN** the view is pinch-zoomed into one part of the track and a finger drags across the canvas
- **THEN** the view pans with the finger, letting the user reach any other part of the track at the same zoom

#### Scenario: Drag at fit view
- **WHEN** the view is at 1× and a finger drags across the canvas
- **THEN** the framing does not move
