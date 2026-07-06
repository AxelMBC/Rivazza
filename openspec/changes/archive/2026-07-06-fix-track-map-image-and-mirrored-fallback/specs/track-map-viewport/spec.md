# track-map-viewport (delta)

## MODIFIED Requirements

### Requirement: Heuristic camera only without bounds data
The anchored, zoomed-out heuristic camera SHALL be used only when no `map.ini` metadata exists for the track (e.g. mod tracks without map data), and the on-canvas note SHALL distinguish this case (drawing blind) from the bounds-known case (map image missing but scale known). The heuristic camera's projection SHALL use the same world-to-screen handedness as the `map.ini` transform — world +Z maps down-screen — so the driven line is never mirrored relative to the other rendering modes and turn direction on the map always matches turn direction in the car.

#### Scenario: Mod track without any map data
- **WHEN** a session starts on a track with neither `map.png` nor `map.ini`
- **THEN** the fallback anchored camera behavior applies, as today

#### Scenario: Turn handedness matches across modes
- **WHEN** the driver takes a left-hand corner on a track with no map data (heuristic camera)
- **THEN** the drawn line curves in the same screen direction it would on a track rendered through the `map.ini` transform — a left in the car is the same-handed curve on screen in both modes
