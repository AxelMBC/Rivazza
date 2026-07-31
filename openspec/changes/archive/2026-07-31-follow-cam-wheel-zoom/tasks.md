## 1. Publish the camera's window limits

- [x] 1.1 Add a `followLimitsRef` (`{ min: number; max: number }`) beside `followWindowRef` in `TrackMap`, initialized to `{ min: 0, max: Infinity }` so input arriving before the first tracking frame can never read a bound the camera has not computed yet
- [x] 1.2 In `followCamera`'s `following` branch, write `minWindow`/`maxWindow` into `followLimitsRef` right where they are already derived, and note in the comment that the input handlers read it to detect the wide-end escape
- [x] 1.3 Add `followWindowRef.current !== lastFollowWindow` to the rAF loop's dirty gate (with the matching `lastFollowWindow` bookkeeping), so a retarget on an otherwise-idle frame still runs the camera

## 2. Wheel retargets instead of detaching

- [x] 2.1 In `onWheel`, branch on `followRef.current === "following"` before any `zoomRef` work; leave the existing cursor-anchored path untouched for `off` and `detached`
- [x] 2.2 In the tracking branch, compute the requested window as `followWindowRef.current * ZOOM_STEP ** (e.deltaY / 100)` — the inverse exponent of the level formula, since a smaller window is a higher zoom — and comment why the sign flips
- [x] 2.3 If the requested window exceeds `followLimitsRef.current.max`, call `setFollow("exiting")` instead of writing the window, so the wide end leaves follow mode through the existing eased return; otherwise write the request unbounded and let `followCamera` clamp it as it does today
- [x] 2.4 Add the `exiting` branch: a notch in (`deltaY < 0`) returns to `following` with `followWindowRef` seeded at `followLimitsRef.current.max`; a notch out is ignored
- [x] 2.5 Delete `stepFollowZoom` and replace its role with the wheel/pinch math (nothing else calls it once the buttons are gone)

## 3. Pinch parity on touch

- [x] 3.1 In `onTouchMove`'s two-finger branch, drop the `detachFollow()` call and split on `followRef.current === "following"`: retarget with `followWindowRef.current *= prev.dist / lastPinch.dist`, ignoring midpoint drift; otherwise run the existing midpoint-anchored `zoomRef` path unchanged
- [x] 3.2 Apply the same past-`max` rule as the wheel in the retarget path — `setFollow("exiting")` rather than clamping
- [x] 3.3 Confirm the one-finger branch still calls `detachFollow()` and that `detachFollow` now has exactly one caller; keep its comment accurate (pan detaches because follow mode has no pan)
- [x] 3.4 Verify `onTouchEnd`'s `ZOOM_SNAP_LEVEL` snap and its `detached → off` transition are unreachable from a retargeting pinch — **the check found it reachable**: a retargeting pinch now leaves `touchMoved` set while still tracking, so the snap could write `zoomRef` mid-glide. Gated the snap on a new `cameraOwnsZoom()` helper (following/exiting ⇒ the camera owns the transform, handlers must not write it)

## 4. Remove the zoom-step buttons and collapse the dwell plumbing

- [x] 4.1 Delete the two `ZOOM_STEP_BUTTONS` entries and their `.map` block from the overlay JSX, leaving the exit button alone in the row
- [x] 4.2 Delete `onZoomTap`, `ZOOM_STEP_BUTTONS`, `ZOOM_DWELL_MS`, and `FOLLOW_WINDOW_STEP`
- [x] 4.3 Collapse `DwellTarget` to `"follow" | "exit"`, then replace the `DWELL_MS` / `DWELL_FILL_CLASS` records with `FOLLOW_DWELL_MS` and the single literal `duration-[1000ms]` class string (both remaining roles share one duration)
- [x] 4.4 Revert `dwelling` to a boolean — only one element can be dwelling now — and simplify the progress-indicator condition accordingly
- [x] 4.5 Keep `armReadyRef` and trim its comment to its remaining single purpose: guarding the follow/exit swap under a still-parked cursor (the one-step-per-dwell job retires with the steps)
- [x] 4.6 Update the follow-overlay comment block and the `followWindowRef` comment, which both describe the zoom-step buttons as the thing that retargets the camera (also the `FollowState`, `ZOOM_STEP`, `FOLLOW_WINDOW_M`/`HEADROOM`, `detachFollow`, and `resetLines` comments, all of which named steps or wheel-detach)
- [x] 4.7 Reset `followLimitsRef` in `resetLines` alongside `followWindowRef` — a new session may be a different track, so the published bounds must go back to "not known until the camera says so"

## 5. Pin the car to the centre (reported: at high zoom the car flies off screen)

- [x] 5a.1 Diagnose: easing the camera toward a target that moves every frame settles at an error of ~speed × `FOLLOW_TAU_S` (~18 m at racing speed), which is sub-pixel across the fit view but wider than the canvas at a tight follow window — so the car leaves the screen
- [x] 5a.2 Replace the pan ease with an offset decay: store the camera's offset from the car in base-projection px (`camOffPx`), decay it by `exp(-dt/FOLLOW_TAU_S)` on its own clock, and derive `ox`/`oy` from car + offset. Zero steady-state error at any speed and any zoom, and entry is still one eased glide because it starts as one large offset
- [x] 5a.3 Seed the offset on the first tracking frame from the view being left behind, so entering follow still glides instead of snapping; zero it on a teleport (the `ANCHOR_SNAP_M` branch) so the camera snaps with the car instead of sweeping after it
- [x] 5a.4 Split the `exiting` path out of the shared ease — the fit view is a static target, so it has no lag term to cancel and keeps easing straight at it
- [x] 5a.5 Preserve idling: on a settled camera over a stationary car the pinned framing rewrites identical values, so no frame is dirtied
- [x] 5a.6 Add `FOLLOW_MIN_WINDOW_M = 100` as a floor under the tight-end clamp, so the tightest framing still shows track around the car rather than only the car and its own trail
- [x] 5a.7 Verify at the tightest framing while driving: marker offset from canvas centre 1.0–1.4 px across 16 samples, max frame-to-frame change 0.3 px (smooth), marker present in every frame; 6/6 checks
- [x] 5a.8 Re-run the interaction suite after the camera rewrite — 23/23 (the mid-exit-resume check needed fixing: it raced a fixed scroll burst against the exit glide, which is now shorter because the tightest framing is wider)

## 5b. Suspend cursor picking while following (reported: overwhelming with >1 stored lap)

- [x] 5b.1 Suppress at the single choke point — `hitTestLaps` returns the empty result while the camera drives the view, which takes out the readout, the line-hover ring, the hover emphasis, the focus-revealed brake ticks and cut markers, and the pointer cursor together
- [x] 5b.2 Scope it to `following`/`exiting` only: `detached` keeps picking, because detaching is the user deliberately taking the view off the car to look around
- [x] 5b.3 Leave the deliberate focus sources alone — `hoveredLapRef` (session lap list) and `analysisLapRef` (analysis panel), plus the scrub ring, are resolved outside the hit test and keep working while following
- [x] 5b.4 Rename `cameraOwnsZoom` → `cameraDrivesView`, now that the same predicate answers both "handlers must not write `zoomRef`" and "the cursor does not pick"
- [x] 5b.5 Verify with the canvas cursor (the `pointer` style is set from the same `hit.nearest`): picking works with follow off, stays `default` across a grid parked on the car and on the lines under it through several seconds of driving, and is restored on leaving follow — 5/5 checks

## 6. Verify

Driven headlessly (puppeteer-core + Edge, per the verify skill) against a live
frame stream, 22/22 checks green with zero page errors. Tracking vs. detached is
measured from pixels: while tracking the whole world translates under a pinned
car (global frame change ~0.04–0.10), while detached the map is frozen and only
the dot moves (~0.0003) — three orders of magnitude apart, so the two states are
unambiguous from outside.

- [x] 5.1 `npm run build -w web` and `npm run lint -w web` clean
- [x] 5.2 Desktop pass: enter follow, scroll in/out repeatedly — tracking never stops (label stays "Exit follow", world keeps translating at global=0.10) and the framing changes. Car-centering: measured at 5.5 px from canvas centre at the default window; the cursor cannot influence it because the tracking branch returns before `e.offsetX/offsetY` is ever read. (At tight zoom the marker sits tens of px behind centre — the camera's pre-existing `FOLLOW_TAU_S`/`FOLLOW_DELAY_MS` lag in pixels, not a framing shift.)
- [x] 5.3 Tight clamp holds and does not accumulate (input at the limit changes the frame by 0.17, one notch out by 0.22); scrolling out ends follow and lands on the fit framing — 0.0035 frame difference against the pre-follow baseline
- [x] 5.4 Wide-end animation is interruptible: scrolling in mid-exit resumes tracking; scrolling further out lets it finish
- [x] 5.5 Free zoom untouched with follow off — zooms cursor-anchored, and scrolling fully out restores the fit framing to 0.0034
- [x] 5.6 Touch pass: pinch retargets without detaching and tracking continues; one-finger drag detaches (frozen world, 0.0003); the exit dwell works from the detached state; pinching out past the widest framing leaves follow mode
- [x] 5.7 Retargeting takes effect on demand (every wheel/pinch check above moved the framing, which is the dirty-gate term working). The complementary "stops repainting once settled" half was **not** instrumented — it needs a paint counter, and the gate term provably cannot self-trigger (a settled camera rewrites an identical clamped window; when not tracking the camera returns before that write)
- [ ] 5.8 Session reset — **not verified**. The page under test ran in demo-replay mode, so restarting the mock never reached it; a real check needs the live-mode toggle plus a mock restart. The code path is a one-line addition to the existing `resetLines` (task 4.7) and nothing else in the reset was touched
