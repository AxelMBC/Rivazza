## Why

On Shutoko Revival Project the track map shows no road where the driver leaves the AI line. An AI spline is a single
route, so a junction ramp that route never takes is simply absent from it, and SRP's three spline options all describe
the same 191,987-point route. Every SRP layout already ships `data/traffic.json`, CSP's traffic-lane graph, which
covers 304 of the AI line's 305 km plus 55 km of lane the AI never drives. Measured against SRP's own hand-drawn
`map.png`, the AI line leaves 19.6% of the road area undrawn and the lanes 8.3%, the rest being dead-end exit stubs and
one parking area.

## What Changes

- The bridge reads the first `data/traffic.json` among the layout and track-root folders, validates it, applies the
  same `map.ini` bounds cross-check as the AI spline, and sends its lanes as `[x, z]` polylines on a new optional
  `lanes` field of the `session` message.
- The track map draws every lane as a 4 m-wide band in the track-surface tone with a thin neutral outline, beneath the
  AI-spline ribbon and every driving line, in the existing cached track layer. Overlapping and adjacent lanes merge
  into one outlined road. The overview inset shows the lanes too.
- Lanes draw only where the map already has a fixed fit (`map.ini` metadata or track edges). They never create a
  viewport of their own.
- The unarchived `override-and-simplify-ai-splines` change is dropped. SRP was its only case: with the lanes, its
  override raised coverage of `map.png` by 0.1 points (8.3% to 8.2% undrawn) at the cost of reading 229 MB per session.
  Its code leaves the tree and its untracked change directory is deleted.

## Capabilities

### New Capabilities

- `traffic-lanes`: how the track map draws a track's CSP traffic lanes beneath the ribbon.

### Modified Capabilities

- `track-asset-resolution`: the bridge also resolves `data/traffic.json` lanes and sends them on the session message.
- `track-map-viewport`: the track surface may be depicted by traffic lanes as well as by the ribbon.
- `track-map-overview`: the inset depicts the lanes, and they are one of its cached inputs.

## Out of Scope

- Using `map.png`, which the viewport spec forbids, or road meshes from the track's `.kn5` files.
- A viewport fitted to the lanes when a track has neither `map.ini` nor an AI spline. No installed track is in that
  case.
- Lane widths (the file carries none), smoothing the lane polylines, and lane direction, role or speed limits.
- Sector, position or lap meaning for lanes: no boundaries, labels, ticks or hover picking.
- Restoring `web/public/demo/imola.json`, whose uncommitted re-recording currently fails the lap-log replay test.

## Impact

- `packages/protocol/src/index.ts`: optional `lanes` on `SessionInfo`. Additive, so `PROTOCOL_VERSION` stays 1.
- New `bridge/src/content/trafficLanes.ts` (+ test), new `bridge/src/content/mapBounds.ts` (the bounds check, moved
  out of `aiSpline.ts`), `bridge/src/content/trackAssets.ts`, `bridge/src/session.ts`.
- `web/src/components/TrackMap/`: `index.tsx`, `trackGeometry.ts`, `layers.ts`, `palette.ts` or `constants.ts`.
- Reverted: the override and thinning code in `aiSpline.ts`, `trackAssets.ts`, `.gitignore` and `CLAUDE.md`. Deleted:
  `splineOverrides.ts`, `splineOverrides.test.ts`, `aiSpline.test.ts`, the local `bridge/spline-overrides.json`, and
  `openspec/changes/override-and-simplify-ai-splines/`.
- `CLAUDE.md`: the Track assets paragraph and the track-map notes.
- Wire size: SRP's session message grows by ~0.5 MB (23,105 points), sent once per session and per new client.
