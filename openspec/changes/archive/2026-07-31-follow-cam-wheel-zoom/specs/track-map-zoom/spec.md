## MODIFIED Requirements

### Requirement: Scroll-wheel zoom anchored at the cursor
The track map SHALL zoom in and out with the mouse wheel while the cursor hovers the map canvas,
keeping the world point under the cursor fixed on screen as the zoom changes. Zoom SHALL step
exponentially per wheel notch and SHALL be clamped between 1× (the existing fit-to-canvas framing)
and an upper bound of at least 40×. Wheel events over the canvas SHALL NOT scroll the page. This
cursor-anchored behavior applies whenever the follow camera is not tracking — that is, with follow
mode off or detached. While the follow camera is tracking, wheel input instead retargets the
camera's framing around the car and the cursor position is ignored (see `track-map-follow-cam`);
the per-notch proportion SHALL be the same in both cases.

#### Scenario: Zooming into a corner
- **WHEN** the cursor hovers a corner of the track and the wheel scrolls forward
- **THEN** the view magnifies around that corner and the point under the cursor stays under the cursor

#### Scenario: Zoom upper clamp
- **WHEN** the user keeps scrolling forward past the maximum zoom
- **THEN** the zoom stops at the maximum and the view no longer changes

#### Scenario: Cursor anchoring while detached
- **WHEN** follow mode has been detached by a touch pan and the wheel scrolls with the cursor over a corner
- **THEN** the view magnifies around the cursor exactly as it does with follow mode off

#### Scenario: Follow tracking overrides cursor anchoring
- **WHEN** the follow camera is tracking the car and the wheel scrolls with the cursor away from the car
- **THEN** the framing changes around the car and no cursor-anchored zoom occurs

### Requirement: Scrolling fully out restores the fit view
Zooming out to 1× SHALL restore exactly the default fit-to-canvas framing, discarding any
accumulated zoom focus, so scrolling out is the reset gesture. No dedicated reset control SHALL be
required. While the follow camera is tracking, scrolling out SHALL reach the same end state through
the follow camera's own path: widening past the widest follow framing ends follow mode and animates
to exactly the fit framing (see `track-map-follow-cam`), so scrolling out is the reset gesture in
every mode.

#### Scenario: Return to full view
- **WHEN** the user scrolls backward until zoom reaches 1×
- **THEN** the map shows the same framing as before any zooming, with no residual offset

#### Scenario: Scrolling out of follow mode
- **WHEN** the user keeps scrolling out while the follow camera is tracking
- **THEN** follow mode ends and the map settles on exactly the same fit framing, with no residual offset

### Requirement: Pinch-to-zoom anchored at the pinch midpoint
On touch devices, a two-finger pinch on the map canvas SHALL zoom the view, keeping the world point
under the pinch midpoint fixed on screen as the zoom changes (movement of the midpoint during the
gesture pans the view correspondingly). Pinch zoom SHALL respect the same bounds as wheel zoom —
clamped between 1× (the fit-to-canvas framing) and the same upper bound — and SHALL compose over
all projection modes with the same screen-pixel-constant stroke widths, dot radius, and pick radius
as wheel zoom. This midpoint-anchored behavior applies whenever the follow camera is not tracking.
While the follow camera is tracking, a pinch instead retargets the camera's framing around the car
and midpoint movement does not pan (see `track-map-follow-cam`).

#### Scenario: Pinching into a corner
- **WHEN** two fingers spread apart over a corner of the track
- **THEN** the view magnifies around the pinch midpoint and the track point between the fingers stays between the fingers

#### Scenario: Pinch upper clamp
- **WHEN** the user keeps spreading past the maximum zoom
- **THEN** the zoom stops at the maximum

#### Scenario: Moving pinch pans
- **WHEN** the user pinches and drags both fingers across the canvas together
- **THEN** the view zooms and pans following the midpoint, platform-map style

#### Scenario: Follow tracking overrides midpoint anchoring
- **WHEN** the follow camera is tracking the car and two fingers spread apart away from the car
- **THEN** the framing tightens around the car and the view does not anchor to the pinch midpoint

### Requirement: Pinching fully out restores the fit view
Pinching out until the zoom reaches 1× SHALL restore exactly the default fit-to-canvas framing,
discarding any accumulated offset — the same reset semantics as scrolling fully out. Gestures ending
within a small epsilon above 1× SHALL snap to the exact fit framing rather than leaving a residual
sub-pixel offset. While the follow camera is tracking, pinching out past the widest follow framing
SHALL end follow mode and animate to exactly the fit framing instead, reaching the same end state.

#### Scenario: Pinch out to reset
- **WHEN** the user pinches out until the zoom reaches the minimum
- **THEN** the map shows the same framing as before any zooming, with no residual offset

#### Scenario: Pinch out of follow mode
- **WHEN** the user pinches out past the widest follow framing while the camera is tracking
- **THEN** follow mode ends and the map settles on exactly the fit framing
