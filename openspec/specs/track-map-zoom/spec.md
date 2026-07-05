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
