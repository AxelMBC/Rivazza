All work is in `web/src/components/TrackMap.tsx`. Groups 1–2 are a pure
refactor with no behavior change; the feature lands in 3–5.

## 1. Key the dwell bookkeeping per button

- [x] 1.1 Add a `DwellTarget = "follow" | "exit" | "zoomIn" | "zoomOut"` type and a `ZOOM_DWELL_MS = 1500` constant beside `FOLLOW_DWELL_MS`, with `DWELL_MS` / `DWELL_FILL_CLASS` records resolving a target to its duration and its literal Tailwind fill class
- [x] 1.2 Change the `dwelling` state from `boolean` to `DwellTarget | null` and update the follow/exit button's progress indicator to render only when `dwelling` matches its own target
- [x] 1.3 Keep `armReadyRef` a global boolean — per-target keying breaks the follow/exit role swap (same element, so the swapped-in role asks about a different target, fails to block, and self-fires). Record why in the comment: reaching another button always fires `mouseleave`, so a global flag cannot block a button the cursor travelled to
- [x] 1.4 Give `startDwell` a `DwellTarget` parameter, take the timeout duration from `DWELL_MS`, and dispatch the completed dwell's effect through a `fireDwell` helper
- [x] 1.5 Verify the follow button still behaves identically: dwell arms at 3 s, progress shows, leaving cancels, and the button swap after activation does not self-toggle

## 2. Make the follow window a ref

- [x] 2.1 Add `followWindowRef` seeded from `FOLLOW_WINDOW_M`, with a comment recording the two-writer ordering (buttons write freely; `followCamera` clamps and writes back each frame)
- [x] 2.2 Read `followWindowRef.current` in `followCamera` where `FOLLOW_WINDOW_M` is used to compute `level`, keeping the constant as the default seed
- [x] 2.3 Reset `followWindowRef` to `FOLLOW_WINDOW_M` in the session-reset path that already writes `zoomRef = ZOOM_RESET` and `setFollow("off")`
- [x] 2.4 Verify follow mode is unchanged so far: entry glide, tracking, exit, wheel detach, and restart reset all behave as before

## 3. Clamp and write back in the camera

- [x] 3.1 Add `FOLLOW_WINDOW_STEP = 1.35` and `FOLLOW_WINDOW_HEADROOM = 0.95` constants, commenting that the headroom keeps `level` strictly above 1 so the car-centered-at-1× framing is unreachable
- [x] 3.2 In `followCamera`, derive `maxWindow = min(width, height) / pxPerMeter × FOLLOW_WINDOW_HEADROOM` and `minWindow = min(width, height) / (ZOOM_MAX × pxPerMeter)` from the values already in scope
- [x] 3.3 Clamp the window into `[minWindow, maxWindow]`, use the clamped value for `level`, and write it back to `followWindowRef` so repeated steps at a limit cannot accumulate
- [x] 3.4 Verify the write-back never re-dirties a settled camera (the clamped value is identical once settled, so `followAnimating` stays false)

## 4. Add the buttons

- [x] 4.1 Add a `stepFollowZoom` arrow function that multiplies or divides `followWindowRef.current` by `FOLLOW_WINDOW_STEP` — bounds are the camera's job, not the handler's
- [x] 4.2 Render the zoom-in and zoom-out buttons in the overlay gated on `followUi === "following"`, laid out compactly beside the exit button without displacing it
- [x] 4.3 Wire each button's mouse path to `startDwell` with its own target and `leaveDwell` on leave, firing `stepFollowZoom` on dwell completion
- [x] 4.4 Wire the touch path mirroring `onFollowTap`: step immediately on `pointerType === "touch"`, stamp `touchToggleAtRef` so the synthesized `mouseenter` on the still-mounted button cannot start a phantom dwell
- [x] 4.5 Style with the semantic Tailwind tokens from `web/src/index.css` `@theme`, matching the existing follow/exit button treatment and its dwell-progress indicator; keep every function an arrow function

## 5. Verify against the spec

- [x] 5.1 Run `npm run lint -w web` and `npm run build -w web`
- [x] 5.2 Drive the mock (`npm run mock -w bridge` + `npm run dev`, per the `verify` skill) and confirm: buttons appear only while tracking, are absent in off/detached/exiting, and each step glides smoothly without detaching
- [x] 5.3 Confirm single-step-per-hover: a parked cursor fires exactly once, and leaving and returning fires again
- [x] 5.4 Confirm the clamps: repeated steps in stop at max zoom, repeated steps out stay strictly zoomed in beyond the fit view, follow never ends from a step, and one step back moves the framing immediately
- [x] 5.5 Confirm render idling: pause the mock, apply a step, and confirm repainting stops once the camera settles
- [x] 5.6 Confirm resets: a stepped window survives lap completion and is discarded on session restart
- [x] 5.7 Confirm the wheel still detaches from a stepped framing with no jump, and that no interaction anywhere requires a click
