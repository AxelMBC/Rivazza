# Send track map metadata and edges on the session message instead of HTTP routes

## 1. Wire contract

- [x] 1.1 In `packages/protocol/src/index.ts`, add `meta: MapMeta | null` and `edges: TrackEdges | null` to `SessionInfo` and remove `mapAvailable`, `boundsAvailable` and `edgesAvailable`

## 2. Bridge

- [x] 2.1 In `bridge/src/content/trackAssets.ts`, drop `mapImagePath` from `TrackAssets` and the `map.png` lookup in `resolveTrackAssets`
- [x] 2.2 In `bridge/src/index.ts`, build `session` with `meta: assets?.meta ?? null` and `edges: assets?.edges ?? null`, and remove the module-level `trackAssets` variable
- [x] 2.3 In `bridge/src/index.ts`, replace `createTrackAssetServer(...)` with `new WebSocketServer({ port, path })`; move the startup log and `ac.start()` to `wss.on("listening")`, keep the error handler, and close with `wss.close()` in `shutdown`
- [x] 2.4 Delete `bridge/src/trackAssetServer.ts`
- [x] 2.5 In `bridge/scripts/record.ts`, remove `httpBase`, `mapOutPath`, `mapAssets`, `captureMap` and the companion-file write and log lines

## 3. Web

- [x] 3.1 Change `buildTrackGeometry` (`web/src/components/TrackMap/trackGeometry.ts`) to take `(meta, edges)` instead of `MapData`
- [x] 3.2 In `web/src/components/TrackMap/index.tsx`, read `session.meta` and `session.edges` in place of `mapData`; make them the render effect's dependencies (not an object built during render)
- [x] 3.3 Show the "No map file" note when `session.meta` and `session.edges` are both `null`
- [x] 3.4 Delete `web/src/components/TrackMap/useTrackMapData.ts`, `BRIDGE_HTTP` in `web/src/hooks/useTelemetry.ts` and `DEMO_MAP_URL` in `web/src/lib/demo.ts`

## 4. Demo data and docs

- [x] 4.1 With a one-off scratchpad script, write `imola.map.json`'s `meta` and `edges` into the `session` entry of `web/public/demo/imola.json`, delete its three flags, and rewrite the file compactly
- [x] 4.2 Delete `web/public/demo/imola.map.json`
- [x] 4.3 In `web/public/demo/README.md`, replace the "Demo assets" section (the track outline now lives in the recording's `session` message; regenerate by re-recording) and drop the stale "placeholder" warning
- [x] 4.4 In `CLAUDE.md`, update the architecture diagram's HTTP line, the `record` command's `.map.json` mention, and the "Track assets" paragraph's routes

## 5. Verification

- [x] 5.1 Run `/axl:verify`
- [x] 5.2 Live (`npm run mock -w bridge` + `npm run dev`): reload the page mid-lap — the first drawn frame is already in the final framing, with no snap from a wider auto-fit view; DevTools Network shows no `/api/track-map/*` request
- [x] 5.3 Open `http://localhost:3001/api/track-map/meta` in a browser — it returns 426 immediately while the dashboard keeps streaming
- [x] 5.4 Demo (`npm run dev:demo`): the Imola track-limits ribbon and sector division render, and Network shows no `imola.map.json` request
- [x] 5.5 Recorder (`npm run record -w bridge -- --out <scratch>.json --duration 5` against the mock): no `.map.json` is written and the recorded `session` entry carries `meta` and `edges`
