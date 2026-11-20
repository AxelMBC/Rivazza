## MODIFIED Requirements

### Requirement: Scroll-wheel zoom anchored at the cursor
The track map SHALL zoom in and out with the mouse wheel while the cursor hovers the map canvas, keeping the world point under the cursor fixed on screen as the zoom changes. Zoom SHALL step exponentially per wheel notch and SHALL be clamped between 1× (the existing fit-to-canvas framing) and an upper bound that is the larger of 40× and the zoom at which about 30 m of world spans the canvas's smaller dimension, so the deepest zoom shows a similar stretch of road on every track however large its map. Wheel events over the canvas SHALL NOT scroll the page. This cursor-anchored behavior applies whenever the follow camera is not tracking — that is, with follow mode off, including after a touch pan has ended follow mode. While the follow camera is tracking, wheel input instead retargets the camera's framing around the car and the cursor position is ignored (see `track-map-follow-cam`); the per-notch proportion SHALL be the same in both cases.

#### Scenario: Zooming into a corner
- **WHEN** the cursor hovers a corner of the track and the wheel scrolls forward
- **THEN** the view magnifies around that corner and the point under the cursor stays under the cursor

#### Scenario: Zoom upper clamp
- **WHEN** the user keeps scrolling forward past the maximum zoom
- **THEN** the zoom stops at the maximum and the view no longer changes

#### Scenario: Large map zooms to road scale
- **WHEN** the user scrolls to the maximum zoom on a track whose fit framing spans many kilometres, as SRP's does
- **THEN** about 30 m of world spans the canvas's smaller dimension

#### Scenario: Small track keeps 40×
- **WHEN** the fit framing at 40× already shows less than 30 m across the canvas's smaller dimension
- **THEN** the maximum zoom is 40×, as before

#### Scenario: Cursor anchoring after a touch pan ended follow
- **WHEN** a touch pan has ended follow mode and the wheel scrolls with the cursor over a corner
- **THEN** the view magnifies around the cursor exactly as it does with follow mode off

#### Scenario: Follow tracking overrides cursor anchoring
- **WHEN** the follow camera is tracking the car and the wheel scrolls with the cursor away from the car
- **THEN** the framing changes around the car and no cursor-anchored zoom occurs
