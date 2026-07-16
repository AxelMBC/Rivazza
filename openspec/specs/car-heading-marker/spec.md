# car-heading-marker

## Purpose

The track map's car position marker: a directional wedge oriented along the car's direction of travel with a steering-input tick at its nose — motion-derived heading (the AC protocol carries no yaw), plain-circle fallback, and preservation of the existing marker contract (position, screen-size zoom invariance, z-order, render idling).

## Requirements

### Requirement: Directional wedge replaces the car dot
The track map SHALL render the car's position as a wedge (pointed) marker oriented along the car's direction of travel, replacing the plain circle. The marker SHALL keep the current dot's contract: drawn at the same position (raw frame position, or the smoothed follow position while the follow cam is active), approximately the same screen footprint, constant screen size at every zoom level, drawn above the track ribbon, lap lines, cut markers, and hover elements exactly where the dot draws today, and outlined against the surface so it separates from the driven lines.

#### Scenario: Driving on track
- **WHEN** the car is lapping and telemetry frames arrive
- **THEN** a wedge marker at the car's position points in the direction the car is moving

#### Scenario: Zooming keeps the marker invariant
- **WHEN** the user zooms the map in or out
- **THEN** the marker stays anchored to the car's world position at unchanged screen size, like the dot before it

#### Scenario: Follow mode
- **WHEN** the follow cam is active
- **THEN** the marker renders at the smoothed follow position with correct heading, moving in lockstep with the camera

### Requirement: Heading is derived from motion and correct under mirrored projections
Because the AC remote-telemetry protocol carries no yaw, the marker's orientation SHALL be derived from recent car positions: two world-space anchor points separated by a minimum travelled distance, both projected through the active projection at draw time, with the screen-space angle between them giving the nose direction. The heading SHALL therefore be correct in all projection modes (map metadata, edges-only, fallback auto-fit) and on tracks whose projection is X-mirrored.

#### Scenario: X-mirrored track projection
- **WHEN** the current track's projection flips the X axis relative to world coordinates
- **THEN** the wedge still points along the on-screen direction of travel, never mirrored backwards

#### Scenario: Fallback-mode track
- **WHEN** a track without map.ini renders in the auto-fit driven-line mode
- **THEN** the marker's heading behaves identically to the metadata-projected modes

### Requirement: Heading holds when stationary and snaps on teleports
While the car has not moved beyond the minimum anchor distance (stopped, paused, crawling), the marker SHALL hold its last established heading rather than jitter. A frame-to-frame position jump exceeding the existing teleport threshold (session restart, return to pits) SHALL discard the heading state; the heading SHALL re-establish from fresh motion without the marker visibly sweeping between the old and new orientations.

#### Scenario: Car stops on track
- **WHEN** the car brakes to a halt
- **THEN** the wedge keeps pointing in its last direction of travel without flickering or spinning

#### Scenario: Session restart teleport
- **WHEN** the car teleports to the pit lane on session restart
- **THEN** the marker never sweeps through intermediate angles; heading re-derives from the first meters driven after the teleport

### Requirement: Plain-circle fallback before heading is established
Whenever no heading has been established — no telemetry-bearing session yet, the car has not moved since connect, or heading state was just discarded by a teleport — the marker SHALL render as the current plain circle.

#### Scenario: Fresh connect with a stationary car
- **WHEN** the dashboard connects while the car sits still in the pits
- **THEN** the car is marked with the plain circle until it starts moving

### Requirement: Steering tick deflects with steering input
The marker SHALL include a short accent-colored tick anchored at the wedge's nose indicating steering input: collinear with the heading when the wheel is centered, deflecting toward the steered side proportionally to `steerAngle` normalized over a fixed input range and clamped to full deflection at ±90° of steering-wheel angle. Left steering input SHALL deflect the tick to the left of the nose as seen on screen. The tick SHALL only render when the wedge renders (never on the fallback circle).

#### Scenario: Turning left
- **WHEN** the driver holds 45° of left steering-wheel angle mid-corner
- **THEN** the tick points halfway between straight-ahead and full-left of the wedge's nose

#### Scenario: Wheel centered
- **WHEN** the car drives straight with no steering input
- **THEN** the tick aligns with the wedge's heading

#### Scenario: Beyond the clamp
- **WHEN** the driver applies 150° of steering-wheel angle
- **THEN** the tick shows full deflection (90°) and does not rotate further

### Requirement: Marker preserves render idling and stays non-interactive
The directional marker SHALL NOT add repaint triggers: heading and tick changes arrive only with fresh telemetry frames, which already mark the frame dirty, and an idle map SHALL keep skipping repaints exactly as before. The marker SHALL NOT introduce any pointer interaction (consistent with the hover-only UI: hover picking continues to target lap lines, never the marker).

#### Scenario: Game paused
- **WHEN** telemetry stalls with the map otherwise idle
- **THEN** the map stops repainting exactly as it does today, marker included

#### Scenario: Hover near the marker
- **WHEN** the cursor passes over the marker
- **THEN** hover behavior is identical to today (line picking only); the marker itself reacts to nothing
