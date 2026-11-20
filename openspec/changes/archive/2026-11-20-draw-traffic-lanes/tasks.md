# Draw CSP traffic lanes beneath the track ribbon

## 1. Drop the override change

- [x] 1.1 `git restore bridge/src/content/aiSpline.ts bridge/src/content/trackAssets.ts .gitignore CLAUDE.md` (those four paths only; `web/public/demo/imola.json` stays as it is), then delete `bridge/src/content/splineOverrides.ts`, `bridge/src/content/splineOverrides.test.ts`, `bridge/src/content/aiSpline.test.ts`, `bridge/spline-overrides.json` and `openspec/changes/override-and-simplify-ai-splines/`

## 2. Wire contract

- [x] 2.1 In `packages/protocol/src/index.ts`, add `TrafficLane` (`[number, number][]`, world XZ metres) and an optional `lanes?: TrafficLane[] | null` on `SessionInfo`, with a comment saying absence reads as `null`, like `sections`. `PROTOCOL_VERSION` stays 1

## 3. Bridge

- [x] 3.1 Move the map-bounds cross-check out of `aiSpline.ts` into `bridge/src/content/mapBounds.ts`, taking `[x, z]` pairs and `MapMeta` (80% inside, 10% margin, unchanged), and have `aiSpline.ts` call it
- [x] 3.2 Create `bridge/src/content/trafficLanes.ts` with a pure parse taking the file's text and `MapMeta | null`. It drops a leading BOM, maps each `lanes` entry's `[x, y, z]` points to `[x, z]` rounded to cm, repeats the first point when `loop` is `true`, and drops (never throws on) a lane that isn't an object, has no `points` array, has a point that isn't ≥3 finite numbers, or has fewer than two points. It returns `{ ok: true, lanes } | { ok: false, reason: "invalid" | "empty" | "out-of-bounds" }`
- [x] 3.3 Add `trafficLanes.test.ts` beside it: well-formed lanes map to rounded `[x, z]`; a looping lane ends on its first point; each malformed-lane case is dropped while the others survive; invalid JSON, a JSON array and an object without `lanes` are `invalid`; every lane dropped is `empty`; a BOM is ignored; with `meta`, lanes outside the rectangle are `out-of-bounds` and lanes inside pass; without `meta` no bounds check applies
- [x] 3.4 In `trackAssets.ts`, add `lanes` to `TrackAssets` and resolve them like `resolveSections`: the first existing `data/traffic.json` among the candidates, no fall-through. A read failure or a failed result warns with the file path and its reason; a missing file is silent. `hasMapData` and the "no map data" warning stay as they are
- [x] 3.5 In `bridge/src/session.ts`, put `lanes: assets?.lanes ?? null` on the session
- [x] 3.6 From a scratch script, call `resolveTrackAssets` for `shuto_revival_project_beta`/`main_layout`, `shuto_revival_project_beta`/`tatsumi_pa` and `imola`/`""`. Expect 65 lanes, 32 lanes and `null`, with no lane warning logged

## 4. Web

- [x] 4.1 In `web/src/components/TrackMap/constants.ts`, add `LANE_WIDTH_M = 4`. Its comment carries the measured spacing (neighbouring SRP lanes 3.59 m apart at the median, 3.81 m at p75)
- [x] 4.2 In `trackGeometry.ts`, have `buildTrackGeometry` also take the lanes and return `lanesPath`: one `Path2D` with a `moveTo` per lane, or `null` without lanes
- [x] 4.3 In `TrackMap/index.tsx`, read `session.lanes ?? null`, pass it to `buildTrackGeometry`, hand `lanesPath` to `createLayers`, and add the lanes to the render effect's dependencies. The dirty gate gains no term
- [x] 4.4 In `layers.ts` `renderTrackLayer`, render when `edgesFill` or `lanesPath` exists. Stroke `lanesPath` first in world units with round caps and joins: `TRACK_EDGE` at `LANE_WIDTH_M` plus `2 × TRACK_EDGE_WIDTH` screen px, then `TRACK_FILL` at `LANE_WIDTH_M`. The ribbon fill, sector edges, ticks and labels follow only when edges exist
- [x] 4.5 In `layers.ts` `renderInsetLayer`, stroke `lanesPath` at 1 px in `TRACK_EDGE` beneath the ribbon. Draw stored laps only when neither lanes nor edges exist, and drop `lapsVersion()` from the cache key whenever either does

## 5. Docs

- [x] 5.1 `CLAUDE.md`: in the Track assets paragraph, add `data/traffic.json` (CSP's lane graph, sent as the optional `lanes` and drawn as 4 m bands under the ribbon, only with a fixed fit); in the TrackMap notes, add that the track layer draws the lanes before the ribbon

## 6. Verification

- [x] 6.1 Run `/axl:verify`
- [x] 6.2 Start a session on SRP Main Layout with the bridge running: at 1× the whole network shows as thin neutral lines inside the `map.ini` viewport, the bridge logs no lane warning, and a junction ramp the AI route skips (the one from the screenshot, or any other) is drawn as road under the driven line
- [x] 6.3 On SRP, scroll-zoom to the deepest level over an interchange: the lanes widen into bands registered with the driven line, side-by-side lanes read as one surface with no outline between them, crossings show no hole, and each wheel notch repaints without a visible stall
- [x] 6.4 On SRP with follow off, zoom in two notches: the inset shows the lane network and the viewport rectangle, and completing a lap does not redraw or flicker it
- [x] 6.5 Start a session on Imola: the map looks exactly as before and the bridge logs nothing about lanes
