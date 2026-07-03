# Tasks — track-map-bounds

## 1. Bridge: AC install discovery

- [x] 1.1 Add Steam library discovery to `trackAssets.ts`: `AC_PATH` env → parse `libraryfolders.vdf` path entries → default path; resolve once and log the chosen install (or a warning naming `AC_PATH` as the fix)
- [x] 1.2 Split `resolveTrackAssets` so `data/map.ini` (meta) and `map.png` (image) resolve independently, layout dir before track root; return `{ meta, mapImagePath | null }`
- [x] 1.3 (added during apply) Harden `readWideString` to cut handshake strings at any control character and log unresolved names with `JSON.stringify` — local testing showed Imola's map assets resolve correctly with clean strings, so invisible handshake garbage is the prime suspect for the live failure

## 2. Bridge: expose bounds independently

- [x] 2.1 Add `boundsAvailable` to `SessionInfo` in `bridge/src/types.ts` and mirror in `web/src/types.ts`; set it in `index.ts` from meta presence, keep `mapAvailable` = image + meta
- [x] 2.2 Serve `/api/track-map/meta` whenever meta exists and `/api/track-map/image` only when the image exists (404 otherwise)

## 3. Web: bounds-driven viewport

- [x] 3.1 In `TrackMap.tsx`, fetch meta when `boundsAvailable` and the image only when `mapAvailable`; render via the map.ini projection whenever meta exists, drawing the image only if loaded (bounds-only mode = same projection, no image)
- [x] 3.2 Restrict the anchored heuristic camera to the no-meta case; update the corner note to distinguish "No map image — track bounds from map.ini" from the fully-blind message
- [x] 3.3 `npm run build` clean

## 4. Verification (live AC session)

- [x] 4.1 Restart bridge, confirm the log resolves the real AC install and Imola reports `boundsAvailable: true` (verified live: /api/track-map/meta serves Imola's map.ini bounds; hardened handshake parsing fixed resolution)
- [x] 4.2 Fresh page load on lap 1: line draws inside a fixed, correctly scaled viewport identical to the post-lap framing (user's reference screenshot); no panning or rescaling at any point (user confirmed in live session)
