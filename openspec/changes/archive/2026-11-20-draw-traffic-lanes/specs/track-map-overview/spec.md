## MODIFIED Requirements

### Requirement: Inset shows the track, the car, and the current view
The inset SHALL depict the track at the fit framing, scaled into the inset: the traffic lanes in a thin neutral tone when lanes exist and the track-limits ribbon above them when edge data exists; only when neither exists, the stored lap lines in a single neutral tone. It SHALL show the car's current position as a small dot, and SHALL outline the part of the track the main view currently shows as a rectangle that exactly corresponds to the main canvas's visible area at the current zoom and offset. It SHALL NOT render pedal colours, sector labels, cut markers, or hover readouts.

#### Scenario: Viewport rectangle tracks the main view
- **WHEN** the user wheel-zooms further in over a corner while the inset is visible
- **THEN** the inset's viewport rectangle shrinks around that corner and always outlines exactly what the main view shows

#### Scenario: Car dot on the inset
- **WHEN** the car drives out of the zoomed main view
- **THEN** its dot keeps moving on the inset, showing where it is relative to the viewport rectangle

#### Scenario: Lanes on the inset
- **WHEN** the inset is shown on SRP's `main_layout`, which has lanes but no track edges
- **THEN** the inset depicts the lane network, not the stored lap lines

### Requirement: Inset rendering preserves render idling
The inset's static content (track depiction at the fit framing) SHALL be cached and re-rendered only when its inputs change: canvas size or devicePixelRatio, projection mode or fit framing, track edges, traffic lanes, or the stored lap lines it depicts. Showing the inset, moving the ghost rectangle, and gliding SHALL repaint the map only while something visible changes. When the glide settles, it SHALL snap to its exact target within a sub-pixel epsilon so the map stops repainting. A resting cursor with no pending navigation, a stationary car, and no new telemetry SHALL leave the map idle.

#### Scenario: Idle after navigating
- **WHEN** the telemetry stream is paused, the user rests on the inset, and the glide completes
- **THEN** the map stops repainting until the next input

#### Scenario: Paused and hovering
- **WHEN** telemetry is paused and the cursor rests on the inset after a navigation has already completed at that spot
- **THEN** no further repaints occur

#### Scenario: Completed laps leave a lane depiction alone
- **WHEN** a lap completes on a track whose inset depicts lanes
- **THEN** the inset's cached depiction is not re-rendered on its account
