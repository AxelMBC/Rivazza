# Design: track-map-follow-cam

## Context

The track map (`web/src/components/TrackMap.tsx`) renders in three projection modes (map.ini metadata, edges-only bounds, fallback driven-line auto-fit), all wrapped by a single screen-space zoom layer: `zoomed(base)` maps `px * level + ox, py * level + oy` from a `zoomRef: { level, ox, oy }`. Interaction is deliberately hover + wheel only — no clicks — so the browser never steals window focus (and controller input) from the running game. The rAF loop is dirty-gated: it repaints only when a watched ref's identity changes, with an `easing` flag keeping it live during fallback-view animation.

Follow mode must: activate by hovering a button for 3 s, animate into a comfortable car-centered zoom, track the car with a camera-like smoothing (north-up, pan only), hand off cleanly to manual wheel zoom, and animate back out via a second hover-dwell button.

## Goals / Non-Goals

**Goals:**
- Hands-free entry/exit (hover dwell, never click) consistent with the existing interaction contract.
- Smooth cinematic feel: eased zoom-in, lagged tracking, eased zoom-out — no snapping.
- Works identically in all three projection modes with zero changes to the projections themselves.
- Preserve dirty gating: the map still goes fully idle when the camera is settled and nothing changes.

**Non-Goals:**
- Rotating chase-cam (view stays north-up).
- Any bridge/protocol/type changes.
- Mobile/touch activation.
- Persisting follow state across sessions.

## Decisions

### 1. Follow drives the existing `zoomRef` — no new projection layer

Each animation frame in follow mode computes the target zoom state that centers the car and eases `zoomRef` toward it. Because every mode's projection is already wrapped by `zoomed()`, follow composes with map.ini, edges-only, and fallback modes for free, and all existing behavior (constant stroke widths, hover hit-testing, layer cache keys keyed on `level,ox,oy`) keeps working untouched.

*Alternative considered*: a separate camera transform (view matrix) under the zoom layer — rejected; it would double the projection concepts and force every cache key and the wheel-anchor math to know about both.

Target math (per frame): project the car through the **base** (unzoomed) projection to get `(bx, by)`, then
`ox = width/2 − bx·level`, `oy = height/2 − by·level`. Easing `zoomRef` toward this target gives both the entry zoom-in animation and the continuous tracking lag (the "camera" trails the car slightly) from one mechanism.

### 2. Comfortable zoom = fixed world window, not fixed multiplier

The base fit scale varies enormously between tracks, so a fixed `level` (e.g. 8×) would frame ~80 m on a kart track and ~800 m at Spa. Instead target a world window: `FOLLOW_WINDOW_M ≈ 250` meters across the smaller canvas dimension. Compute base px-per-meter by projecting two world points 1 m apart through the base projection, then `targetLevel = clamp(minDim / (FOLLOW_WINDOW_M · pxPerMeter), 1, ZOOM_MAX)`.

### 3. Follow state machine in a ref

`followRef: { state: 'off' | 'following' | 'detached' | 'exiting' }` (a ref, mutated from the rAF loop and event handlers; a small mirrored React state drives which button renders).

- `off → following`: follow-button dwell completes. Easing toward the car-centered target begins immediately — entry animation and steady tracking are the same easing.
- `following → detached`: any wheel event. The handler applies the normal cursor-anchored wheel math to the *current* `zoomRef` (which already holds the follow transform), so manual zoom seeds seamlessly from where the camera was. Tracking stops; exit button stays.
- `following | detached → exiting`: exit-button dwell completes. Each frame eases `zoomRef` toward `ZOOM_RESET`; on epsilon-snap, set exactly `ZOOM_RESET` and state `off`.
- any → `off`: session change or restart-detected (`resetLines()` gains the follow reset, next to the existing `zoomRef` reset).
- In `detached`, scrolling fully out to 1× already snaps to `ZOOM_RESET`; that also returns state to `off` (the reset gesture dismisses the exit button).

### 4. Dirty gating: write `zoomRef` only when it moves

Follow-mode frames create a fresh zoom object only when the eased value differs from the current one beyond an epsilon (same trick as the fallback `easing` snap). A moving car ⇒ new target ⇒ new object ⇒ `zoom !== lastZoom` marks the frame dirty. A settled camera over a stationary car (game paused, pit) writes nothing and the map goes idle. An `animating` flag (state `following` with unsettled camera, or `exiting`) joins the existing `easing` term in the dirty check so transitions run even without fresh telemetry.

### 5. Buttons: DOM overlays with CSS-driven dwell progress

Two absolutely-positioned overlay buttons (bottom-left, clear of the top legend chips and bottom-right lap legend), Tailwind-styled with the semantic tokens. Dwell = `onMouseEnter` starts a 3000 ms `setTimeout` + a CSS conic-gradient/width progress animation (`transition`/`animation` does the visual; the timeout does the action); `onMouseLeave` clears both. No click handlers at all. The follow button renders only when a telemetry frame exists (there is no car to follow otherwise); the exit button renders in `following`/`detached`.

*Alternative considered*: canvas-drawn buttons — rejected; hit-testing, accessibility, and the progress animation are all free in DOM, and the legend already sets the overlay precedent.

Note: entering a button fires the canvas `mouseleave`, clearing `mouseRef` — hover readouts disappear while dwelling, which is correct.

### 6. Constants

`FOLLOW_DWELL_MS = 3000`, `FOLLOW_WINDOW_M = 250`, `FOLLOW_TAU_S = 0.3` / `ANCHOR_TAU_S = 0.1` (time-based easing, see decision 7), reuse `ZOOM_MAX` and `ZOOM_RESET`.

### 7. Smoothness (added after first playtest: "movement feels janky")

Measured cause: per-frame layer re-renders dropped ~10% of frames to 33 ms during follow, and uneven raw-frame arrival stepped the dot against the smoothed camera. Three fixes:

- **Time-based easing** — camera blend is `1 − e^(−dt/τ)` (τ = 0.3 s) instead of a per-frame factor, so motion speed is refresh-rate independent and glides through dropped frames.
- **Fixed-delay interpolation for the tracked point** — the dot and camera target render `FOLLOW_DELAY_MS = 120` in the past, linearly interpolated between buffered raw frames (snap + buffer reset on >100 m teleports; buffer cleared outside `following`). Frames arrive unevenly (bridge-side Windows timer quantization; the demo recording has gaps up to 40 ms), and a delay longer than the worst gap converts that into constant-velocity motion — which exponential smoothing cannot do, since it inherits the target's unevenness at every step. First iteration used a τ = 0.1 s exponential anchor; replaced after playtest feedback.
- **Line tip clipped at the dot** — the delayed dot trails the raw line tip by up to ~12 m at speed, which made the current-lap line poke out ahead of the car. The newest `TIP_HOLDBACK = 16` samples stay out of the cached layer; `drawCurrentTail` draws them on the main canvas each repaint only up to the dot (nearest held-back sample, then a partial segment to the dot itself). Outside follow mode the dot is the raw tip, so the clip is a visual no-op there.
- **Flat-cost rendering** — all projections are uniform-scale axis-aligned affine maps, so lap lines and the track ribbon are cached as *world-space* `Path2D` objects and stroked under the canvas transform (`lineWidth / scale` keeps widths constant in screen pixels). The current lap batches into one path per quantized pedal-color bucket (12 steps per ramp — visually identical to the continuous lerp). A moving camera now restrokes a few dozen native paths per frame instead of re-projecting every sample in JS; measured >20 ms frames during follow went from 36/360 to ≤3/360. The layer canvases, blit path, cache keys, and dirty gating are unchanged — only the layer renderers' internals changed.

## Risks / Trade-offs

- [Per-frame target churn defeats layer caches] Every camera movement changes `level,ox,oy`, invalidating `trackLayer`/`lapsLayer`/`currentLayer` cache keys each frame → the layers restroke each frame while following. Mitigated by decision 7's world-space Path2D caches: a restroke is a few dozen native path strokes, flat in session length (measured at 60 fps with a full lap history).
- [Teleports (pit return, restart) yank the camera] The easing naturally animates across the jump; restart detection additionally resets follow entirely. No special-casing needed.
- [Dwell buttons intercept wheel events] A cursor resting on a button that scrolls would not zoom the map. Buttons are small and peripheral; acceptable.
- [Zoom clamp on huge canvases/tiny tracks] `targetLevel` can hit the 1 or `ZOOM_MAX` clamp, so "comfortable" degrades to "as close as allowed"; behavior stays well-defined.

## Migration Plan

Single-component change; no data or protocol migration. Rollback = revert the commit.

## Open Questions

None — trigger style, exit gesture, wheel-cancel behavior, and orientation were all settled with the user before this design.
