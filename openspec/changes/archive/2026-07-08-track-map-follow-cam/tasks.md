# Tasks: track-map-follow-cam

## 1. Follow state machine and camera math

- [x] 1.1 Add follow constants (`FOLLOW_DWELL_MS = 3000`, `FOLLOW_WINDOW_M = 250`, `FOLLOW_EASE = 0.08`) and a `followRef` state ref (`'off' | 'following' | 'detached' | 'exiting'`) with a mirrored React state for button rendering, in `web/src/components/TrackMap.tsx`
- [x] 1.2 In the rAF `draw` loop, when state is `following`, compute the car-centered target zoom each frame: base-project the car, derive base px-per-meter (project two world points 1 m apart), `targetLevel = clamp(minDim / (FOLLOW_WINDOW_M · pxPerMeter), 1, ZOOM_MAX)`, target offsets `width/2 − bx·level` / `height/2 − by·level` — and ease `zoomRef` toward it, writing a fresh zoom object only when the eased value moves beyond an epsilon (dirty-gating stays intact when settled)
- [x] 1.3 Implement the `exiting` animation: ease `zoomRef` toward `ZOOM_RESET` each frame, epsilon-snap to exactly `ZOOM_RESET`, then set state `off`
- [x] 1.4 Add an `animating` term to the dirty check (state `following` with unsettled camera, or `exiting`) alongside the existing `easing` flag so transitions run without fresh telemetry
- [x] 1.5 Wire all three projection modes: the follow easing must run in the map.ini, edges-only, and fallback branches (base projection differs per mode; the zoom composition is shared)

## 2. Interaction handoff

- [x] 2.1 In `onWheel`, when state is `following`, switch to `detached` before applying the normal cursor-anchored zoom math (seeding from the current follow transform); keep the existing 1×-snap branch and make it also return state to `off`
- [x] 2.2 Reset follow state to `off` inside `resetLines()` (covers session change and restart detection) and cancel any pending dwell timer

## 3. Overlay buttons

- [x] 3.1 Add the follow button (bottom-left overlay, semantic Tailwind tokens, arrow-function component style): rendered only when state is `off` and a telemetry frame exists; `onMouseEnter` starts a 3 s timeout plus a CSS progress animation, `onMouseLeave` cancels both; timeout completion sets state `following`. No click handlers
- [x] 3.2 Add the exit button in the same slot: rendered in `following`/`detached`, same dwell/progress/cancel behavior, completion sets state `exiting`
- [x] 3.3 Track live-frame availability for button visibility (small state flipped from the existing draw loop or derived from bridge status) so the follow button hides while the bridge is waiting

## 4. Smoothness (added after first playtest — see design decision 7)

- [x] 4.1 Replace the per-frame ease factor with time-based blending (`1 − e^(−dt/τ)`, `FOLLOW_TAU_S = 0.3`) computed from the rAF wall clock (capped at 100 ms for background tabs)
- [x] 4.2 Smooth the tracked point with a short-lag anchor (snap on >100 m teleports); camera target and rendered dot both use it while state is `following`
- [x] 4.5 Replace the exponential anchor with fixed-delay interpolation (`FOLLOW_DELAY_MS = 120`) over buffered raw frames — constant-velocity motion despite uneven frame arrival (demo recording gaps reach 40 ms)
- [x] 4.6 Clip the current-lap line at the dot (`TIP_HOLDBACK = 16` samples held out of the layer, tail drawn per repaint up to the dot) so the line never pokes out ahead of the delayed dot
- [x] 4.3 Convert layer renderers to world-space `Path2D` caches stroked under the projection's affine transform: track ribbon built once per effect, stored laps lazily per lap, current lap batched into per-pedal-color-bucket paths (12 steps per ramp) with same-projection frames still appending only tail segments
- [x] 4.4 Re-measure: rAF frames >20 ms during follow dropped from 36/360 to ≤3/360 (baseline 0-1); full functional suite re-passed with pixel-faithful visuals

## 5. Verification

- [x] 5.1 `npm run lint -w web` and `npm run build -w web` pass
- [x] 5.2 With `npm run mock -w bridge` + `npm run dev`: dwell 3 s on the follow button → animated zoom-in and smooth car tracking; dwell abandoned at 2 s → no activation; wheel during tracking → detached manual zoom with exit button still shown; exit dwell → animated zoom-out to exact fit view; scroll fully out while detached → fit view, exit button dismissed; session restart mid-follow → full reset; map goes idle (no repaints) when the camera settles on a stationary car
