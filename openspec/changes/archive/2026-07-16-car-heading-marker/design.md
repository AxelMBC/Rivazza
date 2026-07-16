## Context

`TrackMap.tsx` draws the car as a white circle (`drawDot`, `DOT_RADIUS = 7`) at `dotWorld(frame)` — the raw frame position, or the smoothed `followPos` while the follow cam is active. The marker is screen-px sized (zoom-invariant) and drawn last, above lines and cut markers.

AC's RTCarInfo carries no yaw/heading — only position (`x`, `z`) and pitch (`carSlope`). It does carry `steerAngle` (steering-wheel angle in degrees; the existing `SteeringBar` treats it as ±180° full deflection). The map projection may be X-mirrored per track (a documented quirk of `map.ini` bounds), so any world-space angle can be flipped on screen.

The map's rAF loop is dirty-gated: it repaints only when a watched input (telemetry frame identity, mouse, zoom, cuts, hover, size, follow animation) changes. This must be preserved.

## Goals / Non-Goals

**Goals:**
- Replace the circle with a wedge pointing along the car's direction of travel, plus an accent-colored steering tick at the nose deflecting with `steerAngle`.
- Identical position, footprint (~`DOT_RADIUS`), z-order, and zoom invariance as the current dot.
- Correct nose direction in all three projection modes and on X-mirrored tracks.
- No change to the dirty-gated idling behavior, and no bridge/protocol/type changes.

**Non-Goals:**
- No physically true front-wheel angle (would need the car's steering ratio; we show normalized input).
- No marker interactivity (hover-only UI rule: the marker stays non-interactive).
- No changes to driven lines, cut markers, follow cam, or hover picking.
- No heading persistence into lap recordings/replays beyond what falls out of position data.

## Decisions

**1. Heading from motion via two world-space anchor points, converted to a screen angle at draw time.**
Keep the last two "anchor" positions of the rendered dot (`dotWorld` output), updating the leading anchor only after the car has moved a minimum world distance (~0.75 m) from it. At draw time, project *both* anchors through the current frame's projection and take `atan2` of the pixel delta.
- *Why not world-space angle directly*: the projection can be X-mirrored per track; a world angle would render the nose backwards there. Projecting both points makes the marker mirror-immune by construction, in every projection mode and at every zoom.
- *Why not screen-space position history*: screen positions change on zoom/pan without the car moving, which would corrupt heading. World anchors re-projected each frame stay correct under any camera motion.
- *Why not reuse the follow-mode `trail` buffer*: it exists only while following and resets on entry/exit; the anchors work uniformly in all modes and naturally track the smoothed `followPos` when following (because they sample `dotWorld`).

**2. Stability from the anchor baseline, not time-based easing.**
A ~0.75 m minimum baseline makes the heading inherently smooth (AC positions are precise; jitter is millimetric), so no angular lerp or extra animation frames are needed. A stationary or crawling car simply stops updating the anchor — the heading *holds* automatically, with no speed threshold to tune. This keeps the dirty-gating story trivial: heading only changes when a fresh frame moves the car, which already triggers a repaint.

**3. Teleport snap: reset anchors on the existing `ANCHOR_SNAP_M` jump signature.**
A frame-to-frame jump larger than `ANCHOR_SNAP_M` (already defined for the follow trail) clears the anchors. The marker falls back to the plain circle until ~1 m of driving re-establishes heading — no 180° sweep through a restart/pit teleport.

**4. Fallback rendering: the current circle.**
Whenever no heading is established (fresh connect, car never moved, post-teleport), `drawDot` renders exactly today's circle. The wedge is strictly additive on top of a known-good baseline.

**5. Steering tick: normalized deflection, ±90° input range.**
`fraction = clamp(steerAngle / 90, -1, 1)`; the tick pivots at the wedge nose, rotated `fraction × 90°` from the heading direction (left steer → tick left of the nose). ±90° rather than SteeringBar's ±180° so ordinary cornering lock is visibly off-center at 14 px. Tick stroke uses the accent design token (Tailwind `@theme` value read via CSS custom property or mirrored constant, matching how the map already resolves its colors); wedge stays white with the `SURFACE` outline for separation from the driven lines.

**6. Geometry via canvas transform.**
`drawDot(px, py)` grows a heading/steering-aware body: `translate(px, py)`, `rotate(screenAngle)`, stroke the wedge path and tick in local screen-px coordinates, restore. Same two call sites, same draw order — nothing else in the render pipeline moves.

## Risks / Trade-offs

- [Heading lags position by the anchor baseline (~0.75 m)] → At speed this is a few milliseconds of travel; visually imperceptible. At crawling speed the nose may point slightly behind the true tangent mid-turn — acceptable for an instrument marker.
- [Reverse gear points the wedge backwards (direction of travel, not nose)] → Accepted: the protocol has no yaw, direction of travel is the honest signal; reversing is rare and brief on track.
- [`steerAngle` scale varies by car (wheel degrees, not wheel-lock fraction)] → The tick is an input indicator, not a physics readout; ±90° clamp reads well for race cars. Revisit only if a car's readout feels dead.
- [Demo/replay and mock feed the same path] → No risk; anchors derive from `dotWorld`, which all modes share. Verify with `npm run mock -w bridge` per the verify skill.

## Open Questions

None blocking. Exact wedge proportions (nose length vs. base width) and tick length are visual-tuning-at-implementation details, constrained to today's footprint.
