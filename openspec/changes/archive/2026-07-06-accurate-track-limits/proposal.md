# Display accurate track limits from the track's AI spline

## Why

The track map currently shows only driven lines on empty space — the official `map.png`
was dropped because AC strokes it at constant width around the AI line (measured: ±0.4 m
stroke, zero correlation with real track width), so it misrepresents track limits. But
every playable track ships `ai/fast_lane.ai`, whose per-point `sideLeft`/`sideRight`
fields are the game's own measured distances from the AI spline to the left/right track
edges. Parsing that gives real track limits: corner-accurate asphalt to judge lines
against, verified locally on all 42 installed track layouts (median widths 6–20 m,
clean closed ribbon on visual inspection).

## What Changes

- The bridge parses `ai/fast_lane.ai` (layout-aware, same resolution order as `map.ini`)
  into left/right track-edge polylines in world XZ, with garbage-tolerant sanity checks
  (version/size validation, side clamping, spike filtering, rejection of stub files and
  of AI files copied from another track).
- A new `/api/track-map/edges` endpoint serves the edge polylines as JSON; the session
  message gains an `edgesAvailable` flag (type contract mirrored in both `types.ts`).
- `TrackMap` draws a filled asphalt ribbon with subtle edge strokes beneath all driving
  lines, cached in its own offscreen layer so the dirty-gated render loop stays cheap.
- When a track has edges but no `map.ini`, the edge bounds fix the viewport from the
  first frame — replacing the anchored heuristic camera for that case.
- `map.png` remains never-drawn.

## Capabilities

### New Capabilities

- `track-limits`: parsing the AI spline's side distances into track-edge polylines on
  the bridge, and rendering them as the track surface (ribbon + edge lines) under the
  driving lines on the web map.

### Modified Capabilities

- `track-asset-resolution`: track edges resolve as a third independent asset alongside
  map metadata and image; a new `/api/track-map/edges` endpoint responds when edge data
  was found; the session message additionally reports `edgesAvailable`.
- `track-map-viewport`: a track with edge data but no `map.ini` metadata gets a fixed
  viewport derived from the edge bounds (plus margin) instead of the anchored heuristic
  camera; the heuristic camera remains only when neither exists.

## Impact

- `bridge/src/aiSpline.ts` (new) — binary `fast_lane.ai` parser + edge computation.
- `bridge/src/trackAssets.ts` — resolve edges alongside map meta.
- `bridge/src/index.ts` — new endpoint; `edgesAvailable` in session message.
- `bridge/src/types.ts` + `web/src/types.ts` — mirrored `TrackEdges` type and
  `SessionInfo.edgesAvailable`.
- `web/src/components/TrackMap.tsx` — edge fetch, ribbon layer, edges-only viewport.
- No new dependencies; no breaking wire-format changes (additive only).
