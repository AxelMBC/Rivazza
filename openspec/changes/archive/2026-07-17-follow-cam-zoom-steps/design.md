## Context

`followCamera` in `web/src/components/TrackMap.tsx` derives its zoom target
each frame from a fixed constant:

```
level  = clamp(min(width, height) / (FOLLOW_WINDOW_M × pxPerMeter), 1, ZOOM_MAX)
target = { level, ox: width/2 − car.px×level, oy: height/2 − car.py×level }
zoom  ←lerp(τ = FOLLOW_TAU_S)→ target        (every frame, camera owns zoomRef)
```

`FOLLOW_WINDOW_M = 250` expresses the zoom as a *world window* — meters across
the smaller canvas dimension — deliberately, so the framing is identical on any
track size and in any of the three projection modes. That framing choice is the
thing this change makes adjustable.

The constraint that shapes everything: **every existing zoom path detaches
follow.** `onWheel` and the pinch handler both write `zoomRef` directly and set
state to `detached`, per the follow-cam spec's "Manual wheel zoom cancels
tracking in place". They must, because two writers to `zoomRef` would fight —
the camera reasserts its target every frame and would immediately undo any
manual write. The wheel resolves that by taking `zoomRef` away from the camera.

The zoom buttons need the opposite outcome from the same conflict, so they must
resolve it differently: not by fighting over `zoomRef`, but by changing the
input the camera computes its target *from*.

```
  wheel / pinch ──▶ zoomRef  ─────────────▶ detach ('detached')
                       ▲
                       │ camera writes every frame
  zoom buttons ──▶ followWindowRef ──▶ followCamera ──▶ stays 'following'
```

The buttons are also the fourth and fifth hover-armed control on this map, and
the first case where more than one dwellable button is on screen at once — the
existing dwell bookkeeping is single-button by construction.

## Goals / Non-Goals

**Goals:**

- Adjust the follow camera's zoom without interrupting tracking.
- Keep the hover-only contract: no click, drag, keyboard, or window focus ever
  required, so the game keeps controller input.
- Reuse the existing eased camera glide for the zoom transition rather than
  animating anything new.
- Preserve render idling — a settled camera over a stationary car must still
  stop repainting.
- Make the degenerate "1× but car-centered" framing unreachable.

**Non-Goals:**

- Changing wheel or pinch behavior. Both still detach; this change adds a path
  beside them, it does not alter them.
- Zoom controls outside follow mode. In `off`/`detached` the wheel already owns
  zoom and needs no buttons.
- Persisting the chosen window across sessions or reloads.
- Rotation, look-ahead, or any other camera framing change. Only the window
  scalar becomes adjustable.

## Decisions

### 1. Buttons retarget the window, never the transform

`FOLLOW_WINDOW_M` stays as the default seed; a new `followWindowRef` holds the
live value and `followCamera` reads it in place of the constant. A step
multiplies or divides the ref by a fixed factor.

Because the camera still computes and owns `zoomRef` every frame, tracking is
never interrupted — the target simply moves, and the existing
`blend = 1 − exp(−dt/FOLLOW_TAU_S)` glides to it. The zoom transition costs no
new animation code.

*Alternative rejected:* write `zoomRef` directly from the buttons and
re-center. That reintroduces the two-writer conflict the wheel path avoids by
detaching, and would need its own animation to avoid a jump — reimplementing
what the camera already does.

*A ref, not state:* the camera reads it from the rAF loop, matching how
`zoomRef` and `followRef` already work. State here would re-render the whole
component on every step for no visual benefit the canvas doesn't already give.

### 2. Clamp at consumption, and write the clamp back

The zoom-out floor cannot be a constant. The window that produces `level = 1`
is `min(width, height) / pxPerMeter` — it depends on canvas size and the
track's projection scale, so a fixed `FOLLOW_WINDOW_MAX_M` that is safe on
Spa is degenerate on a kart track.

So `followCamera` derives both bounds from the values it already has in hand:

```
maxWindow = min(width, height) / pxPerMeter × FOLLOW_WINDOW_HEADROOM   (0.95)
minWindow = min(width, height) / (ZOOM_MAX × pxPerMeter)
```

`FOLLOW_WINDOW_HEADROOM` keeps the level strictly above 1 (≈1.05×), so the
degenerate framing the `track-map-zoom` spec forbids is unreachable rather than
merely avoided. The camera clamps the ref into `[minWindow, maxWindow]` and
**writes the clamped value back** to `followWindowRef`, so the ref cannot drift
past its bounds. Without the write-back, repeated steps at the floor would
accumulate silently and the first several steps back would appear dead.

*Alternative rejected:* clamp inside the button handler. It has no access to
`pxPerMeter` or the canvas size — both are computed inside the rAF loop from
the live projection.

### 3. Multiplicative steps

`FOLLOW_WINDOW_STEP = 1.35` per step, matching the exponential feel of the
wheel's `ZOOM_STEP = 1.2` (a little larger, since a step costs a full dwell
rather than a wheel notch). From the 250 m default: in → 185 → 137 → 101 m;
out → 337 → 456 m. Multiplicative steps keep the perceived increment constant
at every zoom level, which additive meters would not.

### 4. Dwell bookkeeping becomes per-button

Today `dwellTimerRef`, `armReadyRef`, and the `dwelling` boolean are singular
because exactly one dwellable button is ever mounted. With `following` showing
Exit + zoom-in + zoom-out simultaneously, a singular `dwelling` would render one
button's progress on another.

Introduce a `DwellTarget = "follow" | "exit" | "zoomIn" | "zoomOut"` identity,
but apply it only where identity is actually needed:

- `dwelling` becomes `DwellTarget | null` — which button is filling, so the
  progress indicator renders on the right one.
- Dwell duration comes from the target via a `DWELL_MS` record:
  `FOLLOW_DWELL_MS = 3000` for follow/exit, `ZOOM_DWELL_MS = 1500` for the zoom
  buttons. The progress-bar fill duration needs a parallel record of whole
  literal class strings, because Tailwind scans source text and would never
  generate an interpolated `duration-[${ms}ms]`.
- `armReadyRef` **stays a global boolean**. It goes false when any dwell fires
  and re-arms on `mouseleave`.

*Keying `armReadyRef` per button is a trap* (found while implementing, after the
design first called for it). Follow and exit are the *same DOM element* wearing
two labels, so a per-target flag reads `disarmed === "follow"` while the
swapped-in role asks about `"exit"`, fails to block, and self-fires — exactly
the infinite toggle the flag exists to prevent. The case that seemed to demand
keying — one button's disarm blocking another — cannot occur: reaching any other
button necessarily fires `mouseleave` on the current one, which re-arms.

The flag's semantics differ per button but the mechanism is identical. For
follow/exit it guards a *role swap under a parked cursor*; for the zoom buttons
it enforces *single-step-per-hover* — the cursor must leave and return to step
again. Same rule, two reasons.

*Why single-step over hold-to-repeat:* it matches the established idiom of
every other control on this map, and each step is a visible eased glide, so a
repeat tick would fire steps faster than the camera resolves them. The cost is
that a large zoom change takes several hover cycles — accepted, since the
default window is meant to be close to right and the buttons are a nudge.

### 5. Touch taps step immediately, guarded

Mirroring `onFollowTap`: `pointerType === "touch"` steps at once with no dwell,
and stamps `touchToggleAtRef` so `startDwell` swallows the compatibility mouse
events the browser synthesizes afterward. This matters *more* here than for the
follow button: the zoom buttons do not swap on activation, so the synthetic
`mouseenter` lands on the same still-mounted button and would start a real
dwell — a phantom second step — without the existing
`SYNTHETIC_MOUSE_WINDOW_MS` window.

### 6. Reset with the session, not with laps

`followWindowRef` joins the existing session-reset path in `resetLines` /
the session effect that already writes `zoomRef = ZOOM_RESET` and
`setFollow("off")`. Follow mode already ends on restart; the window resets with
it. Lap completion touches neither, matching the existing zoom and follow rules.

## Risks / Trade-offs

- **[The write-back makes `followWindowRef` two-writer]** — buttons write it,
  the camera clamps and writes it back. → The camera only ever writes a value
  clamped from what it read, and both run on the same thread with the rAF loop
  reading once per frame; a step landing between frames is clamped on the next
  one. No lost updates, but the ordering is worth a comment at the ref.

- **[Render idling could regress]** — a step must not leave the loop spinning.
  → Stepping moves the camera's target, so `followAnimating` goes true, the
  glide runs, and the existing sub-pixel settle epsilon terminates it exactly
  as it does for the entry animation. The write-back writes an identical value
  once clamped, so it never re-dirties a settled camera. Verify by stepping
  with the game paused and confirming the map stops repainting.

- **[Three buttons crowd a small map]** — the overlay is shared with the legend
  and the hover readout. → Zoom buttons only exist in `following`, where the
  legend is least useful, and they should sit compactly beside Exit rather than
  claiming new corners.

- **[Dwell refactor touches working touch/mouse code]** — the singular→keyed
  change rewires the follow button's own arming, which carries the fix for a
  previously reported touch bug (tap-to-exit). → The keyed version must keep
  each existing scenario in the follow-cam spec passing; those scenarios are
  the regression suite for this refactor.

- **[`pxPerMeter` is read at the car's position]** — the bounds are derived
  from a local sample. → All three projections are uniform and unrotated (the
  existing code already relies on this for the very same computation), so the
  sample is globally valid. If a non-uniform projection is ever added, this
  assumption breaks in the same place the current code would.
