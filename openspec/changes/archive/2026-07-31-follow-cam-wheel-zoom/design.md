## Context

`TrackMap` has two independent zoom owners. Free zoom lives in `zoomRef` (`{ level, ox, oy }`),
written directly by the wheel and pinch handlers with a cursor-anchor formula. Follow mode owns
`followWindowRef` — the world window in meters it keeps around the car — and `followCamera`
converts that window into a `zoomRef` target every frame, easing toward it. The two owners never
coexist: whichever is in charge, `zoomRef` is the single transform the renderer reads.

Today the handoff between them is one-way and abrupt. `onWheel` starts with

```ts
if (st === "following" || st === "exiting") setFollow("detached");
```

after which the cursor-anchored formula takes `zoomRef` over. The `+`/`−` dwell buttons are the
only way to adjust the follow framing, and they do it the other way — `stepFollowZoom` multiplies
`followWindowRef` and lets the camera keep ownership. That asymmetry is what this change removes:
the wheel becomes a coarse, continuous version of what the buttons did, and the buttons go away.

Two existing invariants constrain the design:

- **The camera owns the clamp.** `followCamera` derives `minWindow`/`maxWindow` from the live
  projection's px-per-meter and the canvas size, clamps `followWindowRef`, and writes the clamped
  value back. Input handlers deliberately write the window unbounded — they have neither term.
- **`FOLLOW_WINDOW_HEADROOM = 0.95`** keeps the widest follow framing strictly inside the window
  that would render at exactly 1×, because a car-centered view at 1× contradicts the fit framing
  that 1× denotes everywhere else in the map.

## Goals / Non-Goals

**Goals:**

- Wheel and pinch during tracking retarget `followWindowRef`; tracking never stops.
- The zoom axis stays continuous at the wide end: one notch past the widest follow framing leaves
  follow mode and animates to the fit view.
- Zoom while tracking is car-centered — the cursor/midpoint contributes nothing.
- Desktop and touch tell the same story for the same gesture class.
- Delete the `+`/`−` buttons and every constant and code path that existed only for them.
- Preserve dirty-gated repainting: a retarget animates, and a settled camera still idles.

**Non-Goals:**

- No pan concept inside follow mode. A one-finger touch drag still detaches; the `detached` state
  stays exactly as it is (including its exit-button and scroll-out-to-1× behavior).
- No change to zoom when follow mode is off — cursor-anchored free zoom is untouched.
- No change to camera smoothing (`FOLLOW_TAU_S`), the delayed-tracking buffer, or the entry
  animation.
- No re-seeding of the follow window from the current free-zoom level when follow activates
  (entering follow still glides to whatever window is set; unchanged today's behavior).

## Decisions

### 1. The wheel writes `followWindowRef`, not `zoomRef`, while tracking

`onWheel` branches on `followRef.current === "following"` before touching `zoomRef` and applies
the inverse of the free-zoom exponent to the window:

```ts
followWindowRef.current *= ZOOM_STEP ** (e.deltaY / 100);
```

Same `ZOOM_STEP` as free zoom, and the sign is flipped relative to the level formula
(`ZOOM_STEP ** (-e.deltaY / 100)`) because a *smaller* window is a *higher* zoom. Using the free
zoom's own per-notch exponent means one notch feels identical whether or not the camera is
following. `FOLLOW_WINDOW_STEP = 1.35` — deliberately coarser than a notch because a dwell was
expensive — dies with the buttons.

_Alternative considered:_ keep writing `zoomRef` and re-derive the window from it. Rejected: it
puts two writers on `zoomRef` on the same frame (handler and camera), which is exactly the fight
for ownership the current design avoids by having the buttons retarget instead.

### 2. The camera publishes its window limits so a handler can tell it is at the wide end

Escaping at the wide end needs a comparison the handlers cannot make: `maxWindow` depends on
px-per-meter and canvas size. So `followCamera` writes what it already computes:

```ts
followLimitsRef.current = { min: minWindow, max: maxWindow };
```

`onWheel` computes the requested window, and if it exceeds the published `max`, it leaves follow
instead of clamping: `setFollow("exiting")`, which reuses the exit button's eased return to
exactly `ZOOM_RESET`. Otherwise it writes the request and lets the camera clamp as it does now.

The ref is initialized to `{ min: 0, max: Infinity }` so a notch arriving before the first
tracking frame (follow armed, no telemetry frame drawn yet) can never spuriously exit; the camera
overwrites it on the first tracking frame. The value can be one frame stale, which is the same
tolerance the existing clamp-on-the-next-frame rule already accepts.

_Alternative considered:_ let the handler exit when the window "looks big" by some fraction of the
track bounds. Rejected — it re-derives a bound the camera already knows exactly, and would drift
from `FOLLOW_WINDOW_HEADROOM`.

_Alternative considered:_ have the camera itself exit when the clamp saturates. Rejected: the
camera clamps every frame, including when a resize shrinks `maxWindow` under a settled window, so
saturation is not evidence of user intent. Only the handler knows a notch was just requested.

### 3. Exiting at the wide end animates rather than snapping, and scrolling back in cancels it

`setFollow("exiting")` is chosen over the instant `zoomRef.current = ZOOM_RESET` the free-zoom
path uses at 1×. At the widest follow framing the level is only ~1/0.95 ≈ 1.05, so a snap would be
a small jump — but it would also snap the car-centered pan offset to the fit offset, which on a
long track is a visible sideways lurch. The eased exit is already written and already correct.

The animation lasts a few hundred milliseconds, during which a user who is still scrolling would
otherwise be scrolling into a dead handler. So during `exiting`: a notch **in** returns to
`following` with the window seeded at the published `max` (resuming from the widest framing, which
is where the exit began), and a notch **out** is ignored (the view is already going out). This
keeps a single continuous axis in both directions and removes the dead zone.

### 4. Car-centered means the handler simply does not read the cursor

No extra work: the camera's target is already `ox = width/2 - car.px * level`. Once the wheel
stops writing `zoomRef`, `e.offsetX/offsetY` are irrelevant while tracking — the cursor keeps
serving only the hover readout and line pick, which continue to work at the new framing. This
also means the hover pick and the zoom no longer fight over what the cursor "means" during follow.

### 5. Pinch retargets, one-finger drag still detaches

`onTouchMove`'s two-finger branch currently calls `detachFollow()` then runs the midpoint-anchored
formula. While `following` it instead retargets with the pinch ratio, mirroring the wheel:

```ts
followWindowRef.current *= prev.dist / lastPinch.dist;
```

and applies the same past-`max` → `setFollow("exiting")` rule. Midpoint drift is dropped, since a
car-centered camera has nothing to pan. The one-finger branch keeps `detachFollow()` — follow mode
has no pan, so a drag genuinely means "let me look somewhere else," and that is what `detached`
is for. `detachFollow` therefore stays, called from one place instead of two.

The `ZOOM_SNAP_LEVEL` end-of-gesture snap in `onTouchEnd` only inspects `zoomRef` and only fires
in the `detached`/off world; a retargeting pinch leaves `zoomRef` to the camera, so it is
unaffected.

### 6. Removing the buttons collapses the dwell plumbing back to a boolean

With `+`/`−` gone, `DwellTarget` reduces to `"follow" | "exit"` — the two roles of a single DOM
element, only one of which can be dwelling at a time. That makes the `DWELL_MS` and
`DWELL_FILL_CLASS` records (already down to one duration since the dwell became 1 s) pure
indirection: they collapse to `FOLLOW_DWELL_MS` and one literal `duration-[1000ms]` class, and
`dwelling` goes back to a boolean. `stepFollowZoom` and `onZoomTap` are deleted;
`ZOOM_STEP_BUTTONS`, `ZOOM_DWELL_MS`, and `FOLLOW_WINDOW_STEP` go with them.

`armReadyRef` stays and keeps its original single purpose: the follow/exit swap happens under a
still-parked cursor, and a browser that re-fires `mouseenter` on DOM mutation would otherwise
dwell the opposite action and toggle forever. Its second job — making one dwell fire exactly one
step — retires with the steps.

### 7. Add the follow window to the dirty gate

The rAF loop's dirty gate runs *before* `followCamera`, so it decides using the previous frame's
`followAnimating`. A retarget on an otherwise-idle map (stationary car, no new frames, cursor
parked) changes only `followWindowRef` — nothing the gate watches — so the camera would not run
and the retarget would sit inert until something else dirtied the frame. In practice the game
streams frames continuously so `frame !== lastFrame` hides this, which is why the existing
button path never showed it. Since the wheel makes retargeting cheap and frequent, add the
explicit term (`followWindowRef.current !== lastFollowWindow`) rather than keep relying on
telemetry arrival. The camera writing an identical clamped value back on a settled frame produces
no dirty, so idling is preserved.

## Risks / Trade-offs

- **[No way to inspect an off-center corner with the mouse while following]** → Accepted and
  intended: that is what the request asks for. The escape hatch is unchanged and now
  continuous — keep scrolling out and the view lands on the fit view, where free zoom works as
  always. The exit dwell remains the direct route.
- **[One-frame-stale limits could exit follow a notch early or late after a canvas resize]** →
  Bounded to a single frame and only on the exact notch that straddles the limit; the camera
  re-clamps immediately either way. Same tolerance the existing design already documents for
  steps landing between frames.
- **[Losing the `+`/`−` buttons removes the only discoverable zoom affordance during follow]** →
  Wheel zoom over the map is already the established interaction for this map (documented in
  `track-map-zoom`), and pinch covers touch. The trade is a smaller overlay that no longer eats
  canvas hover area next to the exit button.
- **[Pinch-out to exit could fire during a sloppy two-finger gesture]** → It requires crossing the
  full widest-framing threshold, and the result is the same eased exit the button gives; pinching
  back in during the animation resumes tracking, so a mis-fire is one gesture to undo.
- **[`detached` becomes touch-only and easy to leave untested]** → Verification explicitly covers
  the one-finger-drag detach and its exit path on the touch pass.
