## Context

`bridge/src/index.ts:55-83` awaits `resolveTrackAssetsForSession` before it broadcasts `session`, so the assets are in
memory the moment the message leaves. The web app then re-requests them: `useTrackMapData` fetches
`/api/track-map/meta` and `/edges` in an effect keyed on `session` (`web/src/components/TrackMap/useTrackMapData.ts:22`).
Until that resolves `mapData` is `null` and the render loop takes the auto-fit fallback (`TrackMap/index.tsx:333`), so
the first frames of every session are drawn in a framing the metadata fit then replaces.

The HTTP server predates the assets: the first commit served `map.png` for an `<img>`, and `meta`/`edges` were added
beside it. The image is no longer drawn and the `*Available` flags have no reader in `web/src`.

The demo recording (`web/public/demo/imola.json`, 26 351 entries) holds exactly one `session` entry, for
`imola`/`imola`, and `imola.map.json` already matches the current `TrackEdges` shape (`pos` present, 3166 vertices).

## Goals / Non-Goals

**Goals:** assets reach the client in the same message as the session they belong to; one delivery path shared by live,
late-join and demo; no field on the wire without a reader.

**Non-Goals:** changing asset parsing, layout resolution, projection or camera behaviour; new laps for the demo.

## Decisions

### 1. Flat nullable fields on `SessionInfo`, not a separate message

`SessionInfo` gains `meta: MapMeta | null` and `edges: TrackEdges | null` and drops the three flags. A separate
`track` message sent after `session` was rejected: it reintroduces a "session without assets yet" window on the client,
which is the bug being fixed, plus an ordering contract between two messages. Nesting under a `trackMap` object was
rejected as a wrapper with no second member; `meta` and `edges` already have their own types in the protocol package.

### 2. The bridge drops its own `http.Server`; `ws` hosts itself

With no asset routes left, the `http.Server` exists only to carry the upgrade, which `new WebSocketServer({ port, path })`
does on its own: `ws` creates the server internally, forwards its `error` (port in use) and `listening` events to `wss`,
answers any plain request with 426 Upgrade Required, and closes it in `wss.close()`. So `wss.on("error")` stays as is,
the startup log and `ac.start()` move to `wss.on("listening")`, and `shutdown` calls `wss.close()`. Keeping a hand-written
404 handler was rejected: it is a second server definition for a status code nobody reads. `trackAssetServer.ts` is
deleted and the module-level `trackAssets` variable goes with it — `session` is the only holder.

### 3. TrackMap reads the fields off `session`, keyed by reference

`useTrackMapData` and `MapData` are deleted. `buildTrackGeometry` takes `(meta, edges)`. The render effect in
`TrackMap/index.tsx` depends on `session.meta` and `session.edges` directly — never on an object assembled during
render, which would be a fresh reference every render and re-run the effect (losing the layer caches) on every
telemetry-driven re-render. Both references change only when a new `session` message arrives, exactly as `mapData` did.
The "No map file" note shows when both are `null`; with no probe there is no "not yet known" state to wait out.

### 4. The demo is migrated in place, not re-recorded

A one-off script (run from the scratchpad, not committed) reads `imola.json` and `imola.map.json`, writes `meta` and
`edges` into the `session` entry, deletes the three flags, and rewrites `imola.json` with the same compact
`JSON.stringify` the recorder uses. `imola.map.json` and `DEMO_MAP_URL` are then deleted. Re-recording was rejected as
unnecessary: the laps are fine and the payload already has the current shape.

## Risks / Trade-offs

- ~130 KB `session` payload on every connect → negligible beside the 60 Hz stream; sent once per session or reconnect.
- Removing the HTTP routes breaks any outside consumer of them → none is known in or around the repo; accepted.
- An older recording without `meta`/`edges` would replay with `undefined` fields → the only recording is migrated in
  this change; the README's regeneration note is replaced by "re-record".

## Open Questions

- none
