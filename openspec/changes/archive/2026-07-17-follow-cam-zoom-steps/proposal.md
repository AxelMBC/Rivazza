## Why

Follow mode frames the car at one fixed zoom — a 250 m world window baked into
`FOLLOW_WINDOW_M`. That window is a compromise: too tight to read a whole
corner sequence on a fast track, too wide to see precise line placement through
a hairpin. Today the only way to change it is the wheel, and the wheel
deliberately *detaches* tracking, so the driver trades the camera away to get
the zoom they want. There is currently no way to be both zoomed where you want
and still following the car.

## What Changes

- Two new zoom-step buttons on the track map, shown **only while follow mode is
  actively tracking** (`following`). One steps the follow window in, one steps
  it out; tracking continues uninterrupted through both.
- The follow camera's comfortable-zoom window becomes runtime-adjustable
  instead of a fixed constant. The buttons retarget the camera; the camera
  keeps sole ownership of the zoom transform, which is what preserves tracking.
- Each button is armed by a hover dwell shorter than the follow button's 3 s,
  firing exactly one step per dwell, with a tap-to-step path on touch. No
  clicks — clicks would pull focus from the game.
- The adjusted window resets to the 250 m default with the session, alongside
  the existing follow/zoom/lap-line reset.
- Not breaking: with no button interaction, follow mode behaves exactly as it
  does today.

## Capabilities

### New Capabilities

None. This extends an existing capability rather than introducing one.

### Modified Capabilities

- `track-map-follow-cam`: new requirements for the two zoom-step buttons —
  their visibility being confined to the `following` state, hover-dwell/tap
  arming, stepping the camera's target window without detaching tracking,
  clamping at both ends (in particular a zoom-out floor that never reaches the
  degenerate 1×-but-car-centered framing), and resetting with the session. The
  existing "Manual wheel zoom cancels tracking in place" requirement gains an
  explicit carve-out: the zoom buttons are not manual zoom input and do not
  detach.

`track-map-zoom` is deliberately **not** modified. Its "1× is exactly the fit
view" invariant is the constraint the zoom-out floor exists to protect, but the
requirement itself is unchanged.

## Impact

- `web/src/components/TrackMap.tsx` — the only code touched. `FOLLOW_WINDOW_M`
  becomes the default seed for a new window ref read by `followCamera`; new
  dwell bookkeeping alongside the existing follow-button dwell; two buttons in
  the overlay; the window ref joins the session-reset path.
- No bridge, protocol, or type-contract changes. Nothing crosses the WebSocket.
- No new dependencies.
- Render idling is preserved: stepping moves the camera's target, so the
  existing `followAnimating` dirty-gate keeps repainting only while the camera
  is actually in motion and settles back to idle afterward.
