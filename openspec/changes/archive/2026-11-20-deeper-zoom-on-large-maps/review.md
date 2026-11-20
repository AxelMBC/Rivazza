# Review: deeper-zoom-on-large-maps

Snapshot: f8e633d5032c7e2d015f42e7739c48b442383180

1. [minor] web/src/components/TrackMap/gestures.ts:100 — a zoom level already above a cap that later shrinks (fallback auto-fit refitting to a track under ~1.1 km after its first lap, or a resize that changes the canvas aspect) is never clamped, so the next wheel-in notch or pinch-out computes `min(cap, level × step)` and zooms out instead of in; same at gestures.ts:182 · open
   Fix: clamp where the cap is written (index.tsx, both branches: when `!cameraDrivesView()` and `zoomRef.current.level > cap`, rescale `zoomRef` to the cap around the canvas centre), or bound the gestures by `Math.max(zoomMaxRef.current, zm.level)` so a zoom-in never lowers the level.

## Decisions

- In `followCamera` (camera.ts:134) the `zoomMaxRef` term can never win: it is at most 30 m, below the 100 m
  `FOLLOW_MIN_WINDOW_M` floor. It is kept because it states the follow-cam spec's "stays within the map's maximum zoom"
  literally; dropping it would shorten `createCamera`'s inputs.
