## 1. Moves (no content edits)

- [x] 1.1 `git mv` `bridge/src/record.ts` → `bridge/scripts/record.ts`
- [x] 1.2 `git mv` `acClient.ts` and `parsers.ts` into `bridge/src/udp/`
- [x] 1.3 `git mv` `sharedMemory.ts` into `bridge/src/shm/`
- [x] 1.4 `git mv` `trackAssets.ts`, `aiSpline.ts` and `carAssets.ts` into `bridge/src/content/`
- [x] 1.5 Rewrite relative import specifiers in every moved file and in `index.ts` (`../types.js`,
      `./udp/acClient.js`, …), then confirm `npm run build -w bridge` passes before any extraction

## 2. Config

- [x] 2.1 `bridge/package.json`: `record` script → `tsx scripts/record.ts`
- [x] 2.2 `bridge/tsconfig.json`: `include` → `["src", "scripts"]`, and confirm `record.ts` is type-checked
      again (`npm run build -w bridge`)

## 3. Extract `acPath.ts`

- [x] 3.1 Move `DEFAULT_AC_PATH`, `STEAM_LIBRARY_CONFIGS`, `discoverAcPath`, `AC_PATH` and the
      `[map]` startup log from `content/trackAssets.ts` into `content/acPath.ts`, with the log text unchanged
- [x] 3.2 `carAssets.ts` and `trackAssets.ts` import `AC_PATH` from `./acPath.js`, and
      `carAssets.ts` no longer imports `trackAssets.ts`

## 4. Extract `frameThrottle.ts`

- [x] 4.1 Create `createFrameThrottle(intervalMs, send)` → `{ push, latest, clear, stop }` and move
      the due-time arithmetic and its comment across verbatim
- [x] 4.2 In `index.ts`: `telemetry` → `throttle.push`, `waiting` → `throttle.clear()`, `getFrame` →
      `throttle.latest`, `shutdown` calls `throttle.stop()`. Remove `latestFrame`, `frameDirty`,
      `nextDueAt` and the bare `setInterval`

## 5. Extract `trackAssetServer.ts`

- [x] 5.1 Create `createTrackAssetServer(getAssets)` returning an `http.Server` with one route table
      for `/api/track-map/{meta,edges,image}`. Keep the status codes, JSON error bodies, content types
      and the CORS header exactly as they are
- [x] 5.2 `index.ts` builds the server through it and attaches the `WebSocketServer` to the result

## 6. Docs

- [x] 6.1 `CLAUDE.md` Architecture: update the paths for parsers, acClient, sharedMemory,
      trackAssets and carAssets. Point Throttling at `frameThrottle.ts`, and mention `acPath.ts`
      as the install discovery that `trackAssets` and `carAssets` share
- [x] 6.2 Remove the uncommitted whitespace-only line in `udp/acClient.ts`, or let `npm run format`
      drop it, and tell the user which
- [x] 6.3 `git grep -n "bridge/src/\(parsers\|acClient\|sharedMemory\|trackAssets\|carAssets\|aiSpline\|record\)"`
      outside `openspec/changes/archive` returns nothing

## 7. Formatting coverage

- [x] 7.1 Add `bridge/scripts/**/*.ts` to the root `format` and `format:check` globs, and confirm
      `format:check` now lists `record.ts`

## 8. Wire-only `types.ts`

- [x] 8.1 Move `HandshakerResponse` from `bridge/src/types.ts` to `udp/parsers.ts`, and have
      `acClient.ts` import it from there
- [x] 8.2 Move `ConnectionStatus` from `web/src/types.ts` to `web/src/hooks/useTelemetry.ts`, and
      repoint `App.tsx`, `ConnectionBadge.tsx` and `SessionHeader.tsx`
- [x] 8.3 Diff the two files with comments stripped: nothing left

## 9. `@rivazza/protocol`

- [x] 9.1 Create `packages/protocol/{package.json,src/index.ts}`. It's types only, with `types`
      and `exports` pointing at `src/index.ts`, and it keeps both files' comments
- [x] 9.2 Add `packages/protocol` to the root `workspaces`, run `npm install`, and confirm
      `node_modules/@rivazza/protocol` links to the package
- [x] 9.3 Repoint every `types` import in `bridge/src`, `bridge/scripts` and `web/src` to
      `@rivazza/protocol`, then delete `bridge/src/types.ts` and `web/src/types.ts`
- [x] 9.4 Add `packages/*/src/**/*.ts` to the `format` / `format:check` globs
- [x] 9.5 Docs: the `CLAUDE.md` Type contract paragraph and layout note, the `code-style.md`
      `types.ts` bullet, and the mirror references in `.claude/commands/opsx/{apply,audit-drift,explore,verify}.md`

## 10. Verification

- [x] 10.1 Run `/opsx:verify` (bridge and web typecheck, lint, formatting). This now includes
      `openspec validate`, because the change has two spec deltas
- [x] 10.2 `npm run dev` with AC closed: the bridge logs the same `[map] using AC install at …` line
      as before and `[bridge] http + ws listening on http://localhost:3001`, with no module-resolution errors
- [ ] 10.3 With `npm run mock -w bridge` + `npm run dev`: a WS client counts ~60 `telemetry`
      messages per second, and the map dot moves smoothly around Magione
- [x] 10.4 With the mock running: `curl -i` `/api/track-map/meta` and `/edges` return 200 JSON and
      `/image` returns 200 `image/png`. An unknown path returns a bare 404, and every response has
      `Access-Control-Allow-Origin: *`
- [x] 10.5 Stop the mock: the dashboard drops to `waiting` within ~5 s and no telemetry frame
      arrives after the `waiting` status
- [x] 10.6 With the mock and bridge running: `npm run record -w bridge -- --duration 10 --out <scratch>/r.json`
      writes the recording and its `.map.json` companion at the requested path
- [ ] 10.7 Ctrl-C the bridge: it exits cleanly with no hang from the throttle interval
- [ ] 10.8 Vercel preview deploy of this branch builds (`tsc -b` resolves `@rivazza/protocol`), and
      the demo replays
