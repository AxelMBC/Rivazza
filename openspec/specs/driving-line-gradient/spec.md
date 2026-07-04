# driving-line-gradient

## Purpose

Color the driven line on the track map by pedal state (throttle/brake/coast) so braking zones and acceleration phases are visible at a glance, persisting per lap in both map-image and fallback breadcrumb modes.

## Requirements

### Requirement: Driven line is colored by pedal state
The track map SHALL render the driven line as a per-segment colored polyline where each segment's color reflects the pedal state sampled at that point: green when throttle input exceeds the brake input and is above a small dead-zone, red when brake input is above the dead-zone and exceeds throttle, and yellow when neither pedal is above the dead-zone (coasting). Color intensity SHALL blend smoothly between these states based on pedal magnitude rather than switching abruptly.

#### Scenario: Full throttle section
- **WHEN** the car travels a section with `gas` ≈ 1.0 and `brake` ≈ 0
- **THEN** the line drawn over that section is green

#### Scenario: Braking zone
- **WHEN** the car travels a section with `brake` > dead-zone and `brake` > `gas`
- **THEN** the line drawn over that section is red

#### Scenario: Coasting
- **WHEN** the car travels a section with both `gas` and `brake` below the dead-zone
- **THEN** the line drawn over that section is yellow

### Requirement: Line persists for the current lap and resets on lap change
The gradient line SHALL accumulate for the entire current lap (not a fixed-length fading trail) and SHALL be cleared when `lapCount` increments, when the session changes, or when telemetry resets.

#### Scenario: Lap completed
- **WHEN** `lapCount` increases by one
- **THEN** the accumulated gradient line is cleared and a new line starts from the car's current position

#### Scenario: Mid-lap accumulation
- **WHEN** the driver is halfway through a lap
- **THEN** the map shows the colored line for everything driven since the lap started, including braking points passed earlier in the lap

### Requirement: Gradient line works in both map modes
The gradient rendering SHALL apply both when a track map image is available (projected via map.ini metadata) and in the fallback breadcrumb mode where the outline is drawn from visited positions.

#### Scenario: Track without map assets
- **WHEN** `mapAvailable` is false and the driver completes part of a lap
- **THEN** the auto-fitted view draws the driven line with the same throttle/brake/coast coloring
