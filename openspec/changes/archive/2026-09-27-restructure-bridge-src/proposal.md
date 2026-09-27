## Why

`bridge/src/index.ts` mixes four jobs: HTTP routing, WebSocket fan-out, session state and the
60 Hz frame throttle. It holds them together with four module-level `let`s that five callbacks
write to. `src/` also contains `record.ts`, which isn't part of the bridge: it's a WebSocket client
CLI. And `carAssets.ts` gets the AC install path from `trackAssets.ts`, which is a coupling between
unrelated modules. None of this is broken, but it makes the bridge harder to read than it needs to
be.

## What Changes

- Move the frame throttle out of `index.ts` into `frameThrottle.ts`. It owns the latest frame, the
  dirty flag, the due-time accumulator and its sweep interval.
- Move the HTTP routes out of `index.ts` into `trackAssetServer.ts`. The three near-identical
  branches become one route table. Status codes, bodies and headers stay the same.
- Move AC install discovery (`AC_PATH`, the Steam `libraryfolders.vdf` scan and the startup log)
  out of `trackAssets.ts` into `acPath.ts`. `carAssets.ts` and `trackAssets.ts` both import it
  from there.
- Group `src/` by data source: `udp/` (acClient, parsers), `shm/` (sharedMemory), `content/`
  (acPath, trackAssets, aiSpline, carAssets). `index.ts` and the two new transport
  modules stay at the root.
- Move `record.ts` from `src/` to `bridge/scripts/`, next to `mock-ac.js`. Point the `record`
  script at the new location and add `scripts` to the bridge `tsconfig.json` `include` so the file
  is still type-checked.
- Update the path references in `CLAUDE.md` to match the new layout.
- Add `bridge/scripts/**/*.ts` to the root `format` and `format:check` globs, which covered only
  `{bridge,web}/src` and stopped checking `record.ts` once it moved.
- Keep bridge-only and web-only types out of the wire contract: `HandshakerResponse` moves to
  `udp/parsers.ts` and `ConnectionStatus` moves to `web/src/hooks/useTelemetry.ts`. After that
  the two `types.ts` files are identical apart from comments.
- Replace the hand-mirrored pair with a single types-only workspace package,
  `packages/protocol` (`@rivazza/protocol`), which both the bridge and the web app import.
  `bridge/src/types.ts` and `web/src/types.ts` are deleted.

The change has no effect on runtime behaviour. The WebSocket messages, HTTP responses, broadcast
timing, startup logs and `npm run …` commands all stay as they are. What changes is where the
wire contract is declared.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cut-detection`: the "Cut events broadcast" requirement said the web `types.ts` mirrors the
  bridge type exactly. It now says `CutEvent` is declared once, in `@rivazza/protocol`.
- `extended-telemetry`: the same change for `TelemetryFrame`.

`render-efficiency` (60 Hz delivery) and `track-asset-resolution` (install discovery, routes)
describe behaviour this change keeps as it is.

## Impact

- **Code:** every file in `bridge/src/` either moves or has its import paths updated. In `web/src`,
  only the `types` import specifiers change, plus `ConnectionStatus` moving.
- **Wire contract:** the shape is unchanged, but it now lives in `packages/protocol/src/index.ts`,
  and both `types.ts` files are deleted. The root `workspaces` gains `packages/protocol`, and
  `package-lock.json` changes.
- **Config:** `bridge/package.json` (the `record` script path) and `bridge/tsconfig.json`
  (`include`).
- **Deploy:** Vercel builds `web/` as its root directory, so `tsc -b` there has to resolve the
  workspace package. That can only be confirmed by a real preview deploy.
- **Docs:** `CLAUDE.md` Architecture section paths and Type contract paragraph, `code-style.md`,
  and the mirror references in the `/opsx:*` command files. Archived changes keep the old paths because
  they are history.
- **Uncommitted work:** `bridge/src/acClient.ts` already has a whitespace-only local edit, and it
  moves with the file.
