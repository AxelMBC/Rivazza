## Context

`bridge/src/` has 9 flat files, about 1,200 lines in total. `index.ts` is the composition root,
but it also contains the HTTP routes and the throttle algorithm inline. The mutable state it
shares (`session`, `trackAssets`, `latestFrame`, `frameDirty`, plus `nextDueAt`) is read and
written from the HTTP handler, the WS `connection` handler, three `ACClient` events and the cut
detector. `record.ts` is a separate program that only shares `types.ts`. `carAssets.ts` imports
`AC_PATH` from `trackAssets.ts`.

## Goals / Non-Goals

**Goals:**
- `index.ts` only does wiring and lifecycle: it creates the pieces, connects them, and handles
  start and shutdown.
- Each piece of mutable state is owned by the one module that needs it.
- Directories reflect where the data comes from, so the core bridge can be read without the dev
  tooling in the way.

**Non-Goals:**
- Any change in behaviour, including the wire format, HTTP responses, broadcast cadence, log text
  and npm script names.
- Refactoring inside `parsers.ts`, `acClient.ts`, `sharedMemory.ts` or `aiSpline.ts` beyond import
  paths.
- A `buildSessionInfo` extraction, or other `index.ts` tidying beyond the two extractions below.
- Updating archived changes.
- Runtime code in the shared package. It holds types only, so nothing has to be built or bundled.

## Target layout

```
bridge/
├── scripts/
│   ├── mock-ac.js
│   └── record.ts               ← from src/
└── src/
    ├── index.ts                wiring + lifecycle
    ├── types.ts                wire contract (mirrored with web)
    ├── frameThrottle.ts        new
    ├── trackAssetServer.ts     new
    ├── udp/
    │   ├── acClient.ts
    │   └── parsers.ts
    ├── shm/
    │   └── sharedMemory.ts
    └── content/
        ├── acPath.ts           new, from trackAssets.ts
        ├── trackAssets.ts
        ├── aiSpline.ts
        └── carAssets.ts
```

## Decisions

### Group by data source, not by technical role

The three folders are the bridge's three sources: the UDP protocol, the shared-memory page and the
AC install on disk. Each folder's files change together and share one kind of failure (a wrong byte
offset, a closed mapping, a missing file).
- *Rejected: a `parsers/` folder for `carAssets`/`trackAssets`.* Only `parsers.ts` is a parser. The
  asset modules do filesystem discovery, INI reading and spline geometry, and a folder named after
  a role would fill up with unrelated files.
- *Rejected: stay flat.* That's reasonable at 9 files. With the three new modules it would be 12,
  and the folder boundaries then describe dependencies that exist today (`content → shm` for the
  static page, nothing crossing `udp ↔ content`).

### `frameThrottle.ts` owns the latest frame

`createFrameThrottle(intervalMs, send)` returns `{ push, latest, clear, stop }`:
- `push(frame)` stores the frame, marks it dirty and runs the due-time check. This is the current
  `ac.on("telemetry")` body.
- `latest()` is what `startCutDetection`'s `getFrame` reads.
- `clear()` replaces `latestFrame = null` on `waiting`. The `!latest` guard means no stale frame
  is flushed after a session ends. `nextDueAt` is **not** reset, which matches today's behaviour
  (the re-anchor branch already absorbs the gap).
- `stop()` clears the sweep interval and is called from `shutdown`. Today the interval is left for
  `process.exit` to kill, and this is the only lifecycle difference in the change.

The catch-up/re-anchor arithmetic and its comment move verbatim. `BROADCAST_HZ` stays in
`index.ts` as configuration and is passed in as the interval.
- *Rejected: `index.ts` keeps `latestFrame` and the throttle only holds `dirty`/`nextDueAt`.* That
  leaves two sources for "the current frame", and they can drift apart on `clear`.

### `trackAssetServer.ts` sits at the `src/` root, not in `content/`

`createTrackAssetServer(getAssets: () => TrackAssets | null): http.Server` is transport to web
clients, not a way of reading the AC install. It goes at the root next to `frameThrottle.ts`, which
corrects the tree sketched during explore. `index.ts` attaches the `WebSocketServer` to the
server it returns.

The route table maps a pathname to a projection of `TrackAssets` plus a responder (JSON or PNG
stream). The observable contract stays the same:
- `Access-Control-Allow-Origin: *` on every response.
- `/meta` and `/edges` return 404 with `{"error":"no map for current track"}` and
  `{"error":"no track edges for current track"}` respectively.
- `/image` and unknown paths return a bare 404.

### `acPath.ts` is resolved and logged at import time, as today

`AC_PATH` is a module-level constant computed once, and the `[map] using AC install at …` /
`not found` log runs when the module first loads. Moving it into `acPath.ts` keeps that timing,
because `index.ts` imports `trackAssets` (→ `acPath`) at startup, and the `[map]` prefix stays so
the log text is identical (`track-asset-resolution` requires the startup log).

### `record.ts` moves to `bridge/scripts/`

This follows the precedent of `mock-ac.js`. `REPO_ROOT` resolves `../..` from the file's own
directory, and `scripts/` is at the same depth as `src/`, so it still points at the repo root.
`tsconfig.json` `include` becomes `["src", "scripts"]`. `mock-ac.js` is JS without `allowJs`, so tsc
still ignores it.

### Wire-only types, then one package

`HandshakerResponse` goes to `udp/parsers.ts`, next to `parseHandshakerResponse`, the function that
produces it. `ConnectionStatus` includes `"connecting"`, which the bridge never sends, so it's a web
state, not a wire type. It goes to `useTelemetry.ts`, which owns that state. That follows the
code-style rule that app-level types live with the module that produces them.

Once both are moved, the two files match, so they merge into `packages/protocol/src/index.ts`. The
package's `package.json` points both `types` and `exports` at that `.ts` file, with no build step:
- The bridge (TS 5.9, `moduleResolution: bundler`) and the web app (TS 6.0.3, `bundler`) each
  type-check the file with their own compiler.
- Every import is `import type`, so tsx and Vite erase it and nothing resolves at runtime.
- The npm workspace symlink resolves to the real path outside `node_modules`, so the file is
  checked as source under each side's strict options.

The bridge's comment about the wheel-array order and the web's comment that `lapCount` N is
"Lap N+1" both move into the package. The web file's "Mirrors bridge/src/types.ts" header goes.
- *Rejected: a `diff` check in `checks`.* It's cheaper, but it only detects drift, while one
  declaration can't drift at all.
- *Rejected: web importing `../../bridge/src/types`.* That makes the web depend on the bridge
  workspace's internals, which is worse than the mirror it replaces.
- *Rejected: a compiled package (`tsc` → `dist/`).* A build step is only needed if the package
  has runtime code, and it doesn't.

## Risks / Trade-offs

- **[Vercel can't resolve `@rivazza/protocol`]** → the project builds `web/` as its root directory
  with `npm install`. npm 7+ run in a workspace member installs the whole workspace, and Vercel
  includes files outside the root directory by default, so the symlink should exist. Only a
  preview deploy confirms it, so that's a manual task. If it fails, turn on "Include files outside
  the Root Directory" in the Vercel project settings.

- **[A broken import path compiles only after the move]** → `npm run build -w bridge` is the gate,
  and the bridge runs via `tsx`, which fails loudly at startup on a bad specifier.
- **[The throttle extraction changes cadence subtly]** → the arithmetic moves verbatim. Only a
  running bridge confirms ~60 msg/s, so that's a manual verification task.
- **[Doc paths go stale]** → `CLAUDE.md` is updated in the same change. `/opsx:audit-drift` catches
  anything missed. The live specs only name `bridge/src/types.ts`, which doesn't move.
- **[Churn in `git blame`]** → do the moves with `git mv` in their own step before editing contents,
  so rename detection still links the history.
