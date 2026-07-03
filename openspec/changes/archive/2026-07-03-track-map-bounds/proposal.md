# Track Map Bounds

## Why

On the user's machine the track map always runs in the "no map file" fallback, even for stock tracks like Imola, and every heuristic for the first-lap viewport (auto-fit, minimum extent, anchored camera) has failed to look right: the view starts wrong and shifts until the first lap completes. The root cause is upstream — the bridge only resolves track assets from a hard-coded default Steam path and requires `map.png` and `map.ini` together, so it never learns the track's real size. AC's `map.ini` contains the exact world dimensions of every track; with it, the viewport can be correct and rock-solid from the first telemetry frame, matching the completed-lap view exactly.

## What Changes

- **Bridge discovers the real AC install** instead of assuming the default path: honor `AC_PATH`, then scan Steam library folders (`libraryfolders.vdf` in the default Steam location) for `assettocorsa`. Log the resolved path (or a clear warning) at startup/session time.
- **Bridge resolves `map.ini` and `map.png` independently**: `map.ini` alone is enough to serve track bounds (`/api/track-map/meta`); the session message reports `mapAvailable` (image + meta) and `boundsAvailable` (meta only) separately.
- **Web fallback uses real track bounds**: when meta is available but the image isn't, the fallback view projects with the same `map.ini` transform as map-image mode — fixed, correctly sized viewport from the very first frame, no camera movement ever, identical framing to the completed-track view.
- **Last-resort heuristic stays** (no `map.ini` at all, e.g. a mod track without map data): keep the anchored zoomed-out camera as today.

## Capabilities

### New Capabilities
- `track-asset-resolution`: bridge locates the AC install (env override → Steam library discovery → default path) and resolves track map metadata and image independently, exposing bounds even when the image is missing.
- `track-map-viewport`: the track map's coordinate projection uses real `map.ini` bounds whenever available — with or without the map image — giving a fixed, correctly scaled view from the first frame; the anchored heuristic camera applies only when no bounds data exists.

### Modified Capabilities
<!-- none — prior capabilities (racer-stats-ui) are not yet archived to openspec/specs/; viewport requirements are captured fully in track-map-viewport -->

## Impact

- `bridge/src/trackAssets.ts` — Steam library discovery, independent ini/png resolution.
- `bridge/src/index.ts` — session gains `boundsAvailable`; meta endpoint serves ini-only tracks.
- `bridge/src/types.ts` + `web/src/types.ts` — `SessionInfo.boundsAvailable`.
- `web/src/components/TrackMap.tsx` — bounds-only rendering path (meta projection without image); heuristic camera demoted to last resort.
- No new dependencies (`libraryfolders.vdf` is parsed with a small regex, same style as `map.ini` parsing).
