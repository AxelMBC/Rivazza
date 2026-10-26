# car-heading-marker

## Purpose

The track map's car position marker: a directional wedge oriented the way the car faces with a steering-input tick at its nose — the car's yaw, which the bridge reads from the physics shared-memory page because the UDP protocol carries none, with motion-derived heading as the fallback wherever that page can't be read, plain-circle fallback when neither is available, and preservation of the existing marker contract (position, screen-size zoom invariance, z-order, render idling).

## Requirements

### Requirement: Directional wedge replaces the car dot
The track map SHALL render the car's position as a wedge (pointed) marker oriented along the car's heading, replacing the plain circle. The marker SHALL keep the current dot's contract: drawn at the same position (raw frame position, or the smoothed follow position while the follow cam is active), approximately the same screen footprint, constant screen size at every zoom level, drawn above the track ribbon, lap lines, cut markers, and hover elements exactly where the dot draws today, and outlined against the surface so it separates from the driven lines.

#### Scenario: Driving on track
- **WHEN** the car is lapping and telemetry frames arrive
- **THEN** a wedge marker at the car's position points the way the car faces

#### Scenario: Zooming keeps the marker invariant
- **WHEN** the user zooms the map in or out
- **THEN** the marker stays anchored to the car's world position at unchanged screen size, like the dot before it

#### Scenario: Follow mode
- **WHEN** the follow cam is active
- **THEN** the marker renders at the smoothed follow position with correct heading, moving in lockstep with the camera

### Requirement: Heading holds when stationary and snaps on teleports
A heading taken from the frame's yaw SHALL be shown as is, so a stationary car keeps its true orientation and a teleport turns the wedge to the new yaw on the next frame without sweeping through intermediate angles. A motion-derived heading SHALL hold its last established value while the car has not moved beyond the minimum anchor distance (stopped, paused, crawling) rather than jitter. A frame-to-frame position jump exceeding the existing teleport threshold (session restart, return to pits) SHALL discard the motion heading state, and that heading SHALL re-establish from fresh motion without the marker visibly sweeping between the old and new orientations.

#### Scenario: Car stops on track
- **WHEN** the car brakes to a halt
- **THEN** the wedge keeps pointing the same way without flickering or spinning

#### Scenario: Session restart teleport
- **WHEN** the car teleports to the pit lane on session restart
- **THEN** the marker never sweeps through intermediate angles: with a yaw it points the car's new orientation at once, and without one it re-derives heading from the first meters driven after the teleport

### Requirement: Plain-circle fallback before heading is established
Whenever the frame carries no `heading` and no motion heading has been established — no telemetry-bearing session yet, the car has not moved since connect, or motion heading state was just discarded by a teleport — the marker SHALL render as the plain circle. A frame that carries `heading` SHALL always render the wedge.

#### Scenario: Fresh connect with a stationary car
- **WHEN** the dashboard connects while the car sits still in the pits and frames carry no `heading`
- **THEN** the car is marked with the plain circle until it starts moving

#### Scenario: Fresh connect with a yaw
- **WHEN** the dashboard connects while the car sits still in the pits and frames carry `heading`
- **THEN** the wedge renders at once, pointing the way the car faces

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

### Requirement: Bridge stamps telemetry frames with the car's yaw
On Windows, while the physics page is readable, every `telemetry` message the bridge sends SHALL carry `heading`: the car's yaw in radians, read as a float32 from offset 208 of `Local\acpmf_physics` when the frame is sent. When the page cannot be read, `heading` SHALL be omitted. `TelemetryFrame.heading` SHALL be declared once, as an optional field in `@rivazza/protocol`, and because older peers ignore it, it SHALL NOT change `PROTOCOL_VERSION`. Reading the yaw SHALL add no timer and no change to the broadcast rate: it happens on the existing send path.

#### Scenario: Same-PC session
- **WHEN** AC runs on the same Windows PC as the bridge
- **THEN** every telemetry message carries a finite `heading`

#### Scenario: No shared memory
- **WHEN** the bridge runs with `AC_SHM=0`, on another platform, or against AC on another PC
- **THEN** telemetry messages carry no `heading`, and are otherwise unchanged

### Requirement: Heading follows the car's yaw, falls back to motion, and is correct under mirrored projections
When the frame carries `heading`, the marker's orientation SHALL be the screen-space angle from the car's position to a point a short distance ahead of it along the yaw's forward direction, both projected through the active projection at draw time. The conversion from AC's yaw to a world-space forward direction SHALL live in one function. When the frame carries no `heading` (no shared memory, or a recording made without it), the orientation SHALL be derived from recent car positions as before: two world-space anchor points separated by a minimum travelled distance, both projected at draw time. In both cases the heading SHALL be correct in all projection modes (map metadata, edges-only, fallback auto-fit) and on tracks whose projection is X-mirrored.

#### Scenario: Drifting
- **WHEN** the car slides through a corner with its nose pointing well inside its direction of travel, and the frame carries `heading`
- **THEN** the wedge points where the car's nose points, not along its path

#### Scenario: Reversing
- **WHEN** the car reverses and the frame carries `heading`
- **THEN** the wedge keeps pointing out of the car's nose, opposite to its motion

#### Scenario: X-mirrored track projection
- **WHEN** the current track's projection flips the X axis relative to world coordinates
- **THEN** the wedge still points the way the car faces on screen, never mirrored backwards, whether the heading comes from the yaw or from motion

#### Scenario: Fallback-mode track
- **WHEN** a track without map.ini renders in the auto-fit driven-line mode
- **THEN** the marker's heading behaves identically to the metadata-projected modes

#### Scenario: Recording without yaw
- **WHEN** the demo build replays a recording whose frames carry no `heading`
- **THEN** the wedge follows the motion-derived heading exactly as before this change
