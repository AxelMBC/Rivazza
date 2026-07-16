## 1. Heading tracker

- [x] 1.1 In `TrackMap.tsx`'s draw-loop scope, add heading anchor state: last two world anchor points sampled from `dotWorld(frame)`, updating the leading anchor only after ~0.75 m of travel, and clearing both on a frame-to-frame jump beyond `ANCHOR_SNAP_M` (reuse the existing constant)
- [x] 1.2 Add a `markerAngle(project)` helper that projects both anchors through the active frame's projection and returns the screen-space `atan2` angle, or `null` when fewer than two anchors exist

## 2. Marker rendering

- [x] 2.1 Extend `drawDot(px, py)` to take the heading angle and current `steerAngle`; when the angle is `null`, render today's circle unchanged (fallback path)
- [x] 2.2 Render the wedge: translate/rotate canvas transform, wedge path within the current ~7 px footprint, white fill with the existing `SURFACE` outline, then restore
- [x] 2.3 Render the steering tick at the wedge nose: `clamp(steerAngle / 90, -1, 1) × 90°` deflection from heading (left input → left of nose on screen), accent design-token color, skipped on the fallback circle
- [x] 2.4 Update all `drawDot` call sites (the three projection-mode branches) to pass the heading angle and steer value; verify draw order and z-position are unchanged

## 3. Verification

- [x] 3.1 Run the mock (`npm run mock -w bridge` + dev servers, per the verify skill) and confirm: wedge points along travel through corners, tick deflects with the mock's steering, circle shows before the car first moves
- [x] 3.2 Verify degenerate cases: heading holds when the mock car is slow/stopped, no angle sweep across a session-restart teleport, follow mode shows the marker moving in lockstep with the camera at correct heading
- [x] 3.3 Confirm render idling: with telemetry stalled and no interaction, the map stops repainting (no new repaint triggers added)
- [x] 3.4 Run `npm run lint -w web` and `npm run build -w web`
