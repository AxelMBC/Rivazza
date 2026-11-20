# traffic-lanes

## Purpose

How the track map depicts a track's CSP traffic lanes (`data/traffic.json`, resolved by the bridge per the `track-asset-resolution` capability): as 4 m bands that merge into one outlined road surface beneath the AI-spline ribbon and every driven line, so an open road network such as SRP shows the junction ramps and lanes its single AI route never drives. The lanes are drawn only inside an existing fixed-fit viewport, through the cached track layer, and carry no sector, position or lap meaning.

## Requirements

### Requirement: Track map draws traffic lanes beneath the ribbon
When the session carries lanes and the track map uses a fixed-fit projection (map metadata or track-edge bounds), the track map SHALL draw every lane as a band 4 m wide in world units, filled in the ribbon's surface tone and outlined by a thin stroke in the ribbon's neutral edge tone, so that lanes that overlap or run side by side merge into one outlined road surface with no outline between them. The band width SHALL scale with zoom like the ribbon, and the outline SHALL keep a constant screen width, so at the fit framing the network reads as thin neutral lines. Lanes SHALL draw beneath the AI-spline ribbon, its edge strokes and sector marks, and beneath every driving line, marker and the car dot. Lanes SHALL carry no sector, position or lap meaning: no sector boundaries, ticks, labels or hover picking on them.

Lanes SHALL be rendered through the same cached offscreen track layer as the ribbon, keyed on the projection, preserving the dirty-gated render loop: they add no repaint input of their own. Without a fixed-fit projection the lanes SHALL NOT be drawn and SHALL NOT create a viewport. When the session carries no lanes the map SHALL render exactly as before this capability.

#### Scenario: Ramp off the AI line
- **WHEN** the driver takes a junction ramp on SRP that the AI spline never drives but a traffic lane covers
- **THEN** the ramp is drawn as road under the driven line

#### Scenario: Lanes merge into one road
- **WHEN** a highway's lanes run side by side, or a ramp's lanes cross the lanes of the road beneath it
- **THEN** they read as one continuous outlined surface, with no outline between adjacent lanes and no hole where lanes cross

#### Scenario: Network at the fit framing
- **WHEN** a session starts on SRP and the map is at 1×
- **THEN** the whole lane network is visible as thin neutral lines inside the `map.ini` viewport

#### Scenario: Zooming re-projects the lanes
- **WHEN** the user scroll-zooms deep over an interchange
- **THEN** the lanes widen into bands that stay registered with the driven line

#### Scenario: Ribbon over lanes
- **WHEN** a track has both resolved edges and resolved lanes
- **THEN** the ribbon, its edges and its sector marks draw on top of the lanes

#### Scenario: Idle map stays idle
- **WHEN** telemetry, mouse, zoom and canvas size are all unchanged on a track with lanes
- **THEN** the presence of the lanes causes no additional repaints

#### Scenario: No fixed fit
- **WHEN** a session carries lanes but neither map metadata nor track edges
- **THEN** the lanes are not drawn and the map behaves as the driven-line fallback it uses today

#### Scenario: Track without lanes
- **WHEN** a session starts on Imola, which ships no traffic lane graph
- **THEN** the map renders exactly as it did before this capability
