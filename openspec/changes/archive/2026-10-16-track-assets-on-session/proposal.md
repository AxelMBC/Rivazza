## Why

The bridge resolves a track's `map.ini` metadata and AI-spline edges before it broadcasts `session`, yet the web app
fetches them afterwards over HTTP. Until that fetch lands the track map draws through the auto-fit fallback and then
snaps to the metadata fit, breaking `track-map-viewport`'s "fully determined before the first telemetry frame". The
split also carries dead weight: an image route nothing requests, three availability flags nothing reads, a probing
hook, and a demo-only companion file that goes stale whenever `TrackEdges` changes shape.

## What Changes

- **BREAKING (wire)**: `SessionInfo` gains `meta: MapMeta | null` and `edges: TrackEdges | null`, and loses
  `mapAvailable`, `boundsAvailable` and `edgesAvailable`. A `null` field is the "not available" signal.
- **BREAKING (HTTP)**: the bridge stops serving `/api/track-map/meta`, `/api/track-map/edges` and
  `/api/track-map/image`. It no longer creates an HTTP server of its own: `ws` hosts the WebSocket on the port and answers 426 to any plain
  request. `trackAssetServer.ts` is deleted.
- The bridge stops looking for `map.png`: `TrackAssets` loses `mapImagePath`.
- The web track map reads `meta` and `edges` straight off `session`; `useTrackMapData`, its HTTP probe and
  `BRIDGE_HTTP` are removed. The "no map file" note keys on both fields being `null`.
- The recorder no longer fetches or writes a companion `<name>.map.json`: the assets travel inside the recorded
  `session` message. Demo mode stops loading `DEMO_MAP_URL`.
- The committed demo is migrated, not re-recorded: `imola.map.json`'s `meta` and `edges` are injected into
  `imola.json`'s single `session` entry (flags dropped), and `imola.map.json` is deleted.

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `track-asset-resolution`: assets are delivered on the session message instead of HTTP endpoints; the image is no
  longer an asset; availability flags are replaced by nullable fields.
- `track-map-viewport`: the bounds condition is expressed as session `meta` being present, not `boundsAvailable`.
- `demo-replay`: the recorder writes no companion map file; the recording alone carries the track outline.

## Out of Scope

- Any change to how `meta` or `edges` are parsed, validated or resolved per layout.
- Any change to track-map rendering, projection or camera behaviour beyond the source of its data.
- Re-recording the Imola demo with new laps.
- An external consumer of the removed HTTP routes: none is known; none is preserved.

## Impact

- `packages/protocol/src/index.ts` — `SessionInfo`.
- `bridge/src/index.ts`, `bridge/src/content/trackAssets.ts`, `bridge/src/trackAssetServer.ts` (deleted).
- `bridge/scripts/record.ts`; `bridge/scripts/mock-ac.js` untouched (it speaks UDP, not the wire format).
- `web/src/components/TrackMap/index.tsx`, `TrackMap/trackGeometry.ts`, `TrackMap/useTrackMapData.ts` (deleted),
  `web/src/hooks/useTelemetry.ts` (`BRIDGE_HTTP`), `web/src/lib/demo.ts` (`DEMO_MAP_URL`).
- `web/public/demo/imola.json` (migrated), `web/public/demo/imola.map.json` (deleted), `web/public/demo/README.md`.
- `CLAUDE.md` — the track-assets paragraph and the `record` command line describe the HTTP routes and `.map.json`.
- Wire cost: ~130 KB (Imola) once per session and per WebSocket (re)connect, inside `session`.
