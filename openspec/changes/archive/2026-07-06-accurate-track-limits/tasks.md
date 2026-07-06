## 1. Bridge — AI spline parsing

- [x] 1.1 Create `bridge/src/aiSpline.ts`: binary `fast_lane.ai` parser (structural validation, sideLeft/sideRight extraction, clamping, median-3 spike filter), edge computation with driver-left = `(dz, −dx)`, closed-loop detection, and the map.ini bounds cross-check gate
- [x] 1.2 Add `TrackEdges` type to `bridge/src/types.ts` and `edgesAvailable` to `SessionInfo`
- [x] 1.3 Resolve edges in `bridge/src/trackAssets.ts` alongside map meta (layout-aware candidate order shared with map.ini)
- [x] 1.4 Serve `/api/track-map/edges` (cm-rounded JSON, 404 when absent) in `bridge/src/index.ts` and set `edgesAvailable` in the session message

## 2. Web — ribbon rendering

- [x] 2.1 Mirror `TrackEdges` and `SessionInfo.edgesAvailable` in `web/src/types.ts`
- [x] 2.2 Fetch `/api/track-map/edges` alongside meta in `TrackMap`
- [x] 2.3 Draw the track ribbon (fill between edges + subtle edge strokes) in a new offscreen layer keyed on `projKey`, blitted beneath the lap layers in both projection modes
- [x] 2.4 Fixed viewport from edge bounds when edges exist without `map.ini` (heuristic camera only when neither exists; on-canvas note only in the blind case)

## 3. Verification

- [x] 3.1 Type-check both workspaces (`npm run build -w bridge`, `npm run build -w web`) and `npm run lint -w web`
- [x] 3.2 Run bridge + mock, verify `/api/track-map/edges` payload for magione (closed ribbon, plausible widths, cm-rounded)
- [x] 3.3 Verify in the browser against the mock: ribbon under the driving line, correct registration with the driven line, zoom/hover/legend unchanged, idle map stays idle
