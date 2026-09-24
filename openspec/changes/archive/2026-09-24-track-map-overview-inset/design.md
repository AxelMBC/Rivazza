## Context

`TrackMap.tsx` wraps every projection mode's `base` projection in one screen-space zoom,
`zoomed(base)`: `px·level + ox, py·level + oy`, read from `zoomRef`. A mouse user can change that
transform only with the wheel (cursor-anchored). Touch can also pan with one finger, and the follow
cam writes `zoomRef` itself, easing it every frame in `followCamera`. The rAF loop is dirty-gated
by identity checks on the refs it reads, plus "still animating" flags (`easing`,
`followAnimating`). The draw loop and the canvas event handlers live in the same `useEffect`
(`TrackMap.tsx:427`). The session reset lives in a separate effect keyed on `session`
(`TrackMap.tsx:385`).

The constraint that shapes everything: in live builds, no interaction may need a click, keyboard
input or window focus. Clicking steals controller input from the game.

## Goals / Non-Goals

**Goals:**
- Reach any part of the track from a zoomed view in one hover gesture, at the current zoom.
- Nothing new in the projection stack. Navigation is one more writer of `zoomRef`, like the follow
  cam.
- The map still goes fully idle once the glide settles.

**Non-Goals:**
- Edge-hover panning. The cost of a jump grows with distance × zoom, and it fires whenever the
  cursor leaves the canvas.
- Sector-jump buttons (arbitrary targets, and they impose their own zoom), and zoom-level memory
  (a possible later `/opsx:tweak`).
- Navigating while follow mode is tracking (the inset is hidden then).
- Showing the inset in the fallback driven-line mode.

## Decisions

### 1. Draw the inset in the existing canvas, not as a DOM overlay

The inset is a rectangle painted last in the frame, above lines, cut markers, the hover readout
and the dot. Slotting it under the readout would have meant reordering the draw sequence the
`render-efficiency` spec fixes (readout before dot). Lines under the inset are never picked, so
only a readout for a line just left of the inset can be partly covered. Hover inside it is decided from `mouseRef`, which the canvas already tracks. A DOM
element on top would receive `mouseenter`/`wheel` itself, would need its own canvas and projection
plumbing, and would break the canvas's `mousemove`/`mouseleave` stream every time the cursor
crossed it. Keeping it in-canvas also lets the wheel handler branch on "cursor inside inset" in one
place.

*Alternative:* a separate `<canvas>` component reading shared refs. Rejected, because it would
duplicate the base projection per mode and add a second rAF loop with its own dirty gate.

### 2. Inset geometry is the canvas scaled down

At 1× the fit framing *is* the canvas, so the inset is the base projection scaled by
`s = insetW / width` and offset to the inset origin `(x0, y0)`:

```
inset(p)        = (x0 + base(p).px·s, y0 + base(p).py·s)
viewport rect   = base-space [(-ox)/L, (w-ox)/L] × [(-oy)/L, (h-oy)/L], then ·s + (x0, y0)
cursor → centre = b = ((m.x - x0)/s, (m.y - y0)/s)          (base-space px)
target zoom     = { level: L, ox: w/2 - b.x·L, oy: h/2 - b.y·L }
```

`insetW = min(INSET_MAX_W, width · 0.2)`, `insetH = insetW · height / width`, anchored `right-4`
and below the pedal legend (`INSET_TOP ≈ 36 px`). The ghost rectangle is the viewport rectangle's
size, centred on the cursor. The geometry is computed in the draw loop and published in a closure
variable `inset: Rect | null` (null when hidden), which the handlers in the same effect read. One
source means the hit area always matches what was painted.

Visibility: `zoom.level ≥ INSET_MIN_LEVEL` (`ZOOM_STEP ** 1.5` ≈ 1.31, between the first and second wheel notch), `followRef` is `off` or `detached`, and the branch
is the map.ini or edge-view one. The fallback branch sets `inset = null`.

### 3. Store the navigation target as a base-space centre and ease it in the loop

`navRef: { bx, by } | null` holds where the main view should be centred, not a full zoom state. A
`navCamera(width, height, dt)` step runs right after `followCamera` in the two fixed-fit branches:

- current centre `c = ((w/2 - ox)/L, (h/2 - oy)/L)`
- ease `c` toward `b` with the same `1 - exp(-dt / FOLLOW_TAU_S)` blend the follow-cam exit uses,
  so both glides feel identical
- write a fresh `zoomRef` at the unchanged `L`, and set `navAnimating = true`
- once `|c - b|·L < 0.5 px`, snap to the exact target, clear `navRef` and stop animating

Because the target is a centre rather than an offset, wheel over the inset (centre-anchored) can
change `L` mid-glide without fighting it. Any input that anchors elsewhere clears `navRef`: wheel
on the main map, a touch pan or pinch, follow activation, and the session reset. Without that, the
glide would override the user's own movement.

*Alternative:* reuse `followRef`'s `exiting` machinery with a movable target. Rejected, because it
would couple navigation to follow-state transitions (`setFollow("off")` on settle, the exit button's
rendering), and those are exactly what a detached-follow navigation must *not* touch.

### 4. The dwell is a timer, not a check in the rAF loop

The rAF gate idles on a parked cursor, so a loop-side "rested long enough?" check would never run.
Instead, `onMouseMove` inside the inset restarts a `setTimeout(INSET_DWELL_MS ≈ 250)` whenever the
cursor leaves a small slop (`INSET_REST_SLOP_PX ≈ 3`) around the dwell anchor. When it fires, it
writes `navRef` from the resting point. `navRef` is a fresh object, so the gate's identity check
(`lastNav`) repaints. Leaving the inset or the canvas clears the timer but not `navRef`: a
committed glide completes.

### 5. Wheel over the inset anchors at the view centre

The existing anchor formula `o' = a - (a - o)·r` with `a = (w/2, h/2)`. The cursor's screen point
is on the inset and has no meaning for the main view, and an off-screen world anchor would drag the
view away from where the user is looking. Same step and clamps as the map wheel, including the
exact-1× reset. Dropping below the threshold hides the inset naturally.

### 6. Hover picking skips the inset

`hitTestLaps` returns the empty result when `mouseRef` is inside `inset`. That clears the readout,
the emphasis and the ring, and `setCursor("default")` follows from `nearest < 0`.

### 7. Touch and click mode

- **Touch:** `onTouchStart` with one touch inside `inset` marks the gesture as an inset gesture.
  Moves are then ignored (no pan or pinch), and `onTouchEnd` within `TAP_SLOP_PX` writes `navRef`
  immediately. It does *not* park `mouseRef` there, which would leave a phantom ghost.
- **Click mode (demo):** a `click` listener is registered only when `CLICK_MODE`. A click inside
  `inset` writes `navRef` immediately. Live builds register no click listener at all.

### 8. Cache the inset's static content on its own layer

`insetLayer` is an offscreen canvas at inset device-pixel size. It holds the track-limits ribbon
(`edgesFill` plus the edge paths through the inset affine), or, without edges, the stored lap
`Path2D`s in one neutral tone. Its key is
`mode | width×height@dpr | fit framing | edges | lapsVersion`, and it deliberately excludes zoom,
so zooming and gliding only re-blit it. Per frame on top of it: the background panel and border,
the viewport rectangle, the ghost rectangle (while hovered), and the car dot. That's a few rects
and an arc. The current lap is not drawn on the inset (it changes every frame, and the dot already
shows where the car is).

## Risks / Trade-offs

- **Occludes part of the main map** (top-right, ~20 % × ~20 %) → It appears from the second wheel notch in, so it
  covers part of the map even at light zoom; it stays small (≤ 220 px) and in a corner, and the ghost keeps its purpose obvious. Revisit the placement if
  sector labels regularly hide under it.
- **An accidental rest on the inset moves the view** → A 250 ms rest is enough to register intent
  but still feels instant. Sweeping through never commits. The ghost shows the landing spot before
  it happens.
- **A glide fighting other writers of `zoomRef`** → Every other anchored input clears `navRef`
  (Decision 3), and the inset is hidden while the follow cam owns the view.
- **Handlers reading a stale `inset` for one frame after a resize** → It is republished on every
  drawn frame, and a resize dirties the gate, so it is at most one frame stale on a canvas that
  just changed size.

## Open Questions

- Should the viewport rectangle be clamped so the view can't be navigated past the track bounds?
  Not needed as specified: targets come from points inside the inset, i.e. inside the fit framing.
