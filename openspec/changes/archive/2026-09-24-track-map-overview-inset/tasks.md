## 1. Inset geometry and visibility

- [x] 1.1 Add the inset constants to `TrackMap.tsx` next to the zoom/follow constants: `INSET_MIN_LEVEL = ZOOM_STEP ** 1.5` (two wheel notches), `INSET_MAX_W`, width fraction `0.2`, `INSET_TOP`, `INSET_DWELL_MS = 250`, `INSET_REST_SLOP_PX`, and the canvas colours for background/border/viewport/ghost/dot, in the existing hex-constant style
- [x] 1.2 In the draw loop, compute and publish the `inset` rect (null when hidden) per design Decision 2: shown only in the map.ini and edge-view branches, at `zoom.level ≥ INSET_MIN_LEVEL`, with `followRef` `off` or `detached`. The fallback branch always sets it to null

## 2. Rendering

- [x] 2.1 Add `insetLayer` (offscreen, inset device-pixel size) holding the fit-framing track depiction: the ribbon fill plus edge strokes when edges exist, otherwise stored lap `Path2D`s in one neutral tone. Key it on mode, size, dpr, fit framing, edges and `lapsVersion`, never on zoom
- [x] 2.2 Each drawn frame with a visible inset, paint after the dot and cut markers and before the hover readout: the panel background and border, the blitted `insetLayer`, the viewport rectangle derived from `zoomRef`, the ghost rectangle centred on `mouseRef` when inside the inset, and the car dot through the inset projection

## 3. Navigation

- [x] 3.1 Add `navRef: { bx, by } | null` and a `navCamera(width, height, dt)` step after `followCamera` in the two fixed-fit branches. It eases the current centre toward the target with the `FOLLOW_TAU_S` blend at the unchanged level, snaps within 0.5 px and clears the target, and drives a `navAnimating` flag
- [x] 3.2 Add `lastNav` and `navAnimating` to the dirty gate so a fresh target repaints and a settled glide idles
- [x] 3.3 Dwell: in `onMouseMove`, while inside the inset, restart the `INSET_DWELL_MS` timer whenever the cursor leaves the slop around its dwell anchor. On fire, write `navRef` from the resting point. Clear the timer on leaving the inset or the canvas and in the effect cleanup
- [x] 3.4 Clear `navRef` (and any pending timer) on cursor-anchored wheel over the main map, touch pan/pinch, follow activation, and in the session/restart reset alongside `zoomRef = ZOOM_RESET`

## 4. Input over the inset

- [x] 4.1 Wheel inside the inset: same step, clamps and exact-1× reset as the map wheel, anchored at `(width/2, height/2)`, keeping `navRef`
- [x] 4.2 `hitTestLaps` returns the empty result when the cursor is inside the inset (no readout, emphasis or ring; cursor stays `default`)
- [x] 4.3 Touch: a single touch starting inside the inset ignores moves (no pan or pinch) and, on end within `TAP_SLOP_PX`, writes `navRef` without parking `mouseRef`
- [x] 4.4 Register a canvas `click` listener only when `CLICK_MODE`. A click inside the inset writes `navRef` immediately

## 5. Docs

- [x] 5.1 Extend the track-map paragraph in `CLAUDE.md` with one sentence on the overview inset (hover-dwell navigation at constant zoom, a writer of `zoomRef` like the follow cam)

## 6. Verification

- [x] 6.1 Run `/opsx:verify`: bridge and web typecheck, lint, formatting and the spec deltas
- [x] 6.2 With the mock and `npm run dev` running, wheel-zoom the map in by one notch and confirm no inset. Give it a second notch and confirm the inset appears top-right under the pedal legend, with the viewport rectangle outlining exactly the visible part of Magione and the car dot moving on it
- [x] 6.3 With the view at ~12× on one corner, hover the far side of the inset and rest there. Confirm a ghost rectangle follows the cursor, and that after ~250 ms the main view glides to that spot at the same zoom, ending with the viewport rectangle where the ghost was
- [x] 6.4 Sweep the cursor quickly across the inset without stopping and confirm the main view does not move
- [x] 6.5 With the cursor over the inset, confirm no lap readout or pointer cursor appears from lines beneath it, and that wheel over the inset zooms around the main view's centre until below two notches in, where the inset disappears
- [x] 6.6 Activate follow (1 s dwell on the button) and confirm the inset hides while tracking and returns after exiting while still zoomed in two notches or more
- [x] 6.7 Stop the mock mid-glide (or restart it) and confirm the map returns to the 1× fit view with no residual glide and no inset
- [x] 6.8 With telemetry paused, navigate once and confirm repaints stop after the glide settles (e.g. rAF-drawn frame counter or Performance panel shows no paint while the cursor rests)
- [x] 6.9 In a demo build (`npm run dev:demo`), confirm a click on the inset navigates immediately, and in a touch-emulated viewport that a tap on the inset navigates without panning the map
