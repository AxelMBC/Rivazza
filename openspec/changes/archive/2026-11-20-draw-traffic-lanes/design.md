## Context

The track map depicts the road only through the AI-spline ribbon (`trackGeometry.ts` builds `edgesFill`, `layers.ts`
caches it in the track layer). An AI spline is one route, so on an open road network the map is blank wherever the
driver leaves that route. The unarchived `override-and-simplify-ai-splines` change pointed SRP at its 305 km spare
spline; it still leaves junction ramps undrawn, because all three of SRP's spline options are byte-for-byte the same
size (229,476,408 bytes, 191,987 points) and almost certainly the same route.

`data/traffic.json` is the file CSP's traffic planner writes. Its shape, read from the installed files (CSP publishes no
schema): `{ areas, rules, intersections, lanes }`, each lane `{ id, name, role, loop, params, priorityOffset, points }`
with `points` as `[x, y, z]` world triples. Only SRP ships one among the installed tracks: identical 1.2 MB files in six
layouts (65 lanes, 23,105 points, 537.6 km of lane) and a different one in `tatsumi_pa` (32 lanes, 3,119 points).
Measured on `main_layout`:

| | value |
| --- | --- |
| point spacing along a lane | median 20.8 m, p95 43.4 m, max 172 m |
| nearest other lane, per point | p25 3.38 m, median 3.59 m, p75 3.81 m, p90 4.10 m |
| AI line within 15 m of a lane | 304.2 of 305.2 km |
| lane length farther than 15 m from the AI line | 55.1 km |
| `map.png` road pixels farther than 17 m from: AI line / lanes / both | 19.6% / 8.3% / 8.2% |

What the lanes miss against `map.png` is dead-end exit stubs at the network's edge and the north-west parking area.

## Goals / Non-Goals

**Goals:** draw SRP's road network, ramps included, without configuration; keep the ribbon's look and its render
contract; change nothing for a track without `traffic.json`.

**Non-Goals:** a viewport fitted to lanes alone; lane widths, smoothing, roles or direction; `map.png` or `.kn5` meshes;
keeping the spline override.

## Decisions

### 1. traffic.json, not map.png, kn5 meshes or the spline override

`map.png` on SRP is a hand-drawn route map and the most complete source, but the viewport spec forbids it. It is a
3.3 m/px raster that blurs at deep zoom, and the bridge has no asset route to serve it. Its route colours are green,
yellow and red, the pedal colours. It also adds only the 8% that is mostly dead-end exits. Road meshes from `.kn5` are
the ground truth, but they need a binary mesh parser and per-session processing of hundreds of megabytes. The override
adds 0.1 points of coverage once the lanes are drawn.

### 2. Bridge: resolved like sections.ini, parsed purely, bounds-checked like the AI spline

`trafficLanes.ts` holds the pure parse, taking the file's text and the `map.ini` metadata. It returns a result that
says why it failed (`invalid` | `empty` | `out-of-bounds`), so `trackAssets.ts` can word its warning. File I/O stays in
`trackAssets.ts`, as for `sections.ini`: the first existing `data/traffic.json` among the candidates, with no
fall-through. The bounds check moves out of `aiSpline.ts` into `mapBounds.ts` now that it has a second consumer, and it
takes `[x, z]` pairs. Lanes do not count toward `hasMapData`: a pass with only lanes cannot be drawn, because the map
has no fixed fit, so falling through to the layout search stays correct. The polylines go out at full resolution
(~0.5 MB for SRP). There is nothing to thin at 23k points.

### 3. Web: one Path2D, cased stroke, under the ribbon in the track layer

`buildTrackGeometry` also returns `lanesPath`, one `Path2D` with a `moveTo` per lane. `renderTrackLayer` strokes it
twice before the ribbon. First comes the outline: `TRACK_EDGE` at the band width plus twice `TRACK_EDGE_WIDTH` in
screen px. Then the fill: `TRACK_FILL` at the band width. Both use round caps and joins. One stroke call composites
once, so overlapping lanes don't stack the outline's alpha. The fill pass covers every outline inside the union, which
leaves one outlined road. This beats filling a polygon per lane, which would leave a hole wherever the nonzero rule
meets a crossing. It also beats bare thin lines, which say nothing about road width when zoomed in.

The band is 4 m wide in world units. Real lanes are ~3.5 m, but neighbouring lane centrelines sit 3.59 m apart at the
median and 3.81 m at p75. A 3.5 m band leaves sliver gaps where the outline shows through as stripes, and 4 m closes
three in four of them. At SRP's fit framing the band is sub-pixel, and the network reads as the 2.5 px outline alone.

`renderTrackLayer` now renders when either `edgesFill` or `lanesPath` exists. Sector edges, ticks and labels still come
only from edges, and `sectorLabelBox` already returns `null` without an anchor. The inset strokes the lanes once in
`TRACK_EDGE` at 1 px under the ribbon. Its cache key drops `lapsVersion()` whenever lanes or edges exist. The lanes
are fixed for the effect's lifetime, so the dirty gate in `index.tsx` gains no term.

### 4. Fixed fit only

Lanes draw only in the `meta` / `edgeView` branch of the render loop. A track with lanes but neither `map.ini` nor an
AI spline would need the edge-bounds viewport, the inset's visibility rule and the "No map file" note all extended, for
a case no installed track has.

### 5. The override change leaves the tree

Its code is uncommitted: `git restore` returns `aiSpline.ts`, `trackAssets.ts`, `.gitignore` and `CLAUDE.md` to `HEAD`,
which holds none of it, before this change edits them. Its new files, the local `bridge/spline-overrides.json` and its
untracked change directory are deleted. `web/public/demo/imola.json` is not touched.

## Risks / Trade-offs

- Points up to 172 m apart draw as straight segments. On a 50 m-radius ramp that is ~1 m of facet, visible only near
  the deepest zoom. → Accepted. Smoothing would invent geometry CSP doesn't have.
- The 4 m band is ~0.5 m wider per lane than the painted road, and shoulders are absent. → Sub-pixel at the fit
  framing. At deep zoom the driven line, not the band, is the reference.
- `traffic.json`'s shape is inferred from installed files, not a published schema. → The parser drops what it can't
  read and never throws. A future CSP shape yields no lanes and a warning, not a broken session.
- SRP's session message grows ~0.5 MB, also sent in every new client's greeting. → Once per session or connection,
  not per frame.
- Deleting `openspec/changes/override-and-simplify-ai-splines/` is irreversible, since the directory is untracked. →
  It is the first task, so the user can stop it before `/axl:apply` runs.

## Open Questions

None.
