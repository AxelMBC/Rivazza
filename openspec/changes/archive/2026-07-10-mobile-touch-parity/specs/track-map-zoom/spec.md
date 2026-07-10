# track-map-zoom (delta)

## ADDED Requirements

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
