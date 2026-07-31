## Why

While the follow camera is tracking the car, any wheel notch kills the tracking and hands the
view to cursor-anchored free zoom. That makes the most natural way to adjust the framing —
scroll — the one gesture that throws the framing away, so adjusting the follow zoom means
dwelling a second on a small `+`/`−` button instead. Scrolling should change how tightly the
camera frames the car, not stop it from following.

## What Changes

- **BREAKING (interaction)**: wheel input during follow tracking no longer detaches. It
  retargets the follow camera's world window — the same thing the `+`/`−` dwell buttons do
  today — and tracking continues uninterrupted.
- Follow-mode wheel zoom is **car-centered**: the cursor's position is ignored while tracking,
  the car stays at the canvas center, and only the amount of world visible around it changes.
  Cursor-anchored zoom remains exactly as it is whenever follow mode is off or detached.
- Scrolling out stays a continuous axis: past the widest follow framing, one more notch out
  **leaves follow mode** and animates to the 1× fit view (the existing exit animation) rather
  than dead-stopping. Scrolling back in during that animation resumes tracking.
- Touch pinch during tracking gets the same treatment — it retargets the follow window instead
  of detaching, and pinching out past the widest framing exits follow. One-finger drag still
  detaches, since follow mode has no pan concept.
- **Removal**: the `+`/`−` hover-dwell zoom-step buttons and their whole dwell path are deleted.
  The wheel and pinch now cover that job on both modalities, leaving only the exit button on the
  overlay.
- The `detached` state survives, now reachable only by a one-finger touch pan; the exit button
  still returns from it.

## Capabilities

### New Capabilities

_None — this changes existing map interaction behavior._

### Modified Capabilities

- `track-map-follow-cam`: the "manual wheel zoom cancels tracking in place" requirement inverts
  into "wheel and pinch retarget the follow camera"; the wide-end clamp becomes an exit into the
  fit view; the four zoom-step-button requirements (visibility, dwell arming, tap-to-step, and
  the retarget/clamp pair written in terms of steps) are removed or rewritten around wheel and
  pinch input.
- `track-map-zoom`: the cursor-anchored wheel requirement and the pinch-midpoint requirement
  gain an explicit follow-mode carve-out (car-centered, midpoint ignored), and the
  "scrolling/pinching fully out restores the fit view" reset acquires its follow-mode form.
- `lap-line-comparison`: cursor picking of stored lap lines (readout, ring, emphasis, and the
  markers that reveal with focus) is suspended while the follow camera drives the view — the map
  sweeps under a parked cursor there, so lines pick themselves and the response thrashes once
  more than one lap is stored. The analysis panel and session-lap-list selections are unaffected
  and become the way to inspect a lap while following.

## Impact

- `web/src/components/TrackMap.tsx` only — the wheel handler, the touch pinch/pan handlers, the
  `followCamera` clamp (which must now publish its window limits so the input handlers can tell
  when a notch escapes the wide end), the dwell plumbing (`DwellTarget` collapses back to
  follow/exit), and the removal of the two zoom-step buttons from the overlay.
- No bridge, protocol, type-contract, or dependency changes. No new state; `FOLLOW_WINDOW_STEP`
  and the zoom-step dwell constants are deleted.
- Touch parity is affected, so the mobile path needs a pass alongside the desktop one.
