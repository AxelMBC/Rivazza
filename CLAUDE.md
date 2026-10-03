# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Live telemetry dashboard for Assetto Corsa (original). A Node bridge speaks AC's
remote telemetry UDP protocol and rebroadcasts frames over WebSocket to a React app
that renders gauges, lap times, and a 2D track map with a live position dot.

```
Assetto Corsa ──UDP 9996──▶ bridge (Node) ──WebSocket :3001──▶ React app :5173
                              └── also serves the track's map.png + map.ini over HTTP
```

## Commands

npm workspaces monorepo (`bridge`, `web`, plus the types-only `packages/protocol`). Run from the repo root:

- `npm run dev` — starts bridge (:3001) and web app (:5173) together via concurrently
- `npm run dev:demo` — web app alone (:5173) replaying the committed recording; no bridge
- `npm run build` — builds both workspaces
- `npm run mock -w bridge` — fake AC on UDP 9996 streaming a car lapping Magione, for developing without the game. **Stop it before running the real game** (both bind 9996).
- `npm run record -w bridge -- [--out web/public/demo/imola.json] [--host …] [--port 3001] [--duration <s>]` —
  records the bridge's WebSocket stream (plus a `.map.json` track outline) for the demo build. Ctrl-C
  or `--duration` ends it; the file is written on exit.
- `npm run lint -w web` — oxlint (the only linter; the bridge has none)
- `npm run build -w bridge` — bridge "build" is `tsc --noEmit` (type-check only; it runs via `tsx`, never compiled to JS)
- `npm run build -w web` — `tsc -b && vite build`

`dev` and `dev:demo` call `tsx` and `vite` **directly** (`tsx watch bridge/src/index.ts`,
`vite web`) instead of delegating through `npm run … -w`. That is deliberate: yarn 1 exports five
`npm_config_*` keys npm 11 rejects, so every nested `npm run` printed five `Unknown env config`
warnings under `yarn dev`. With no npm in the chain there is nothing left to warn, whichever
launcher is used. Both workspaces are fully hoisted (`bridge/node_modules` doesn't exist) and the
bridge reads no `process.cwd()`, so running them from the repo root changes nothing.
`npm run dev -w bridge` and `npm run dev -w web` remain valid per-workspace entry points — the root
script inlines them, so keep the two in step.

`build` deliberately keeps its `npm run … -w` delegation: the root `tsc` is the bridge's 5.9.3,
while `web` pins TypeScript 6.0.3 in `web/node_modules`, and only running with cwd `web/` puts the
right compiler on PATH. `--loglevel=error` silences the same yarn-leaked warnings there instead.

There is **no test framework** in this repo — do not invent test commands. What verification does
mean here is `.claude/rules/verification.md`.

## Bridge configuration (env vars)

`AC_PATH` (game folder for track maps; auto-discovered from Steam library configs if unset), `AC_HOST` (default `127.0.0.1`), `AC_PORT` (default `9996`), `BRIDGE_PORT` (default `3001`), `AC_SHM` (set `0` to disable shared-memory cut detection).

## Architecture

`bridge/src/` is grouped by data source: `udp/` (the AC remote telemetry protocol), `shm/`
(the shared-memory page), `content/` (the AC install on disk). `index.ts` only wires them to the
transport modules beside it. Dev tooling (`mock-ac.js`, `record.ts`) lives in `bridge/scripts/`.

**Binary UDP protocol (`bridge/src/udp/parsers.ts`).** The delicate core. AC sends fixed-size
little-endian structs at exact byte offsets: `HANDSHAKE_RESPONSE_SIZE = 408`,
`RT_CAR_INFO_SIZE = 328`. Message type is disambiguated purely by packet length. Offsets
encode MSVC struct alignment/padding — do not "clean up" the magic numbers. AC's UTF-16LE
strings are fixed 50-wchar buffers with trailing garbage (often a stray `%`); `readWideString`
cuts at the first control char or `%`. Corrupt strings here silently break track-folder lookups.

**Session lifecycle (`bridge/src/udp/acClient.ts`).** `ACClient` runs handshake → subscribe →
RTCarInfo stream. AC never signals session end, so a stale timer (5s of silence) drops back to
handshaking and emits `waiting`. It retries the handshake every 3s while the game is closed.

**Throttling (`bridge/src/frameThrottle.ts`).** AC floods RTCarInfo packets; the bridge keeps only the
newest frame and flushes to WebSocket clients at 60 Hz (needed for the track map's ~1 m line
sampling). Windows quantizes short timers to ~15.6 ms, so a bare 60 Hz `setInterval` fires at
~32 Hz — delivery is instead driven by packet arrival against a due-time accumulator, with the
interval only sweeping up the trailing frame. On the web side, `useTelemetry` updates
`telemetryRef` on every message but throttles React state to ~30 Hz (with a trailing-edge flush),
so text readouts re-render at half rate while canvas rAF consumers keep full fidelity. New WS
clients get a `hello` (current status + session) on connect.

**Cut detection (`bridge/src/shm/sharedMemory.ts`).** Windows/same-PC only. `koffi` (the repo's
only native dependency) maps AC's `Local\acpmf_physics` shared-memory page and polls it at
~60 Hz with offset-based Buffer reads (`packetId`@0, `speedKmh`@28, `numberOfTyresOut`@244 —
magic numbers in the parsers.ts tradition). `numberOfTyresOut` is the game's own
lap-invalidation counter: a `<4 → ≥4` transition across fresh `packetId`s broadcasts a
`{ type: 'cut' }` message stamped with the newest UDP frame's position/lap. Gates (frozen
`packetId`, `inPit`, speed < 10 km/h, no live session) suppress pause/menu/teleport noise.
Anywhere the page can't be read (non-Windows, `AC_SHM=0`, remote `AC_HOST`, koffi load
failure) the feature is silently off — never let it affect the UDP path. The mock writes the
same mapping with periodic fake excursions. Web side: `useTelemetry` accumulates cuts
(`cutsRef` + `cutSeq` signal), `useLapHistory` turns them into authoritative lap invalidity
plus the live current-lap INV cue, and `TrackMap` draws red × markers — ambient only
while the invalid lap is in progress; stored laps reveal theirs on hover (their map
line, or their session-lap-list row via the shared `hoveredLapRef`).

**Track assets (`bridge/src/content/trackAssets.ts`, served by `bridge/src/trackAssetServer.ts`).** Reads `content/tracks/<track>/[<config>/]data/map.ini`
for projection bounds; served at `/api/track-map/meta`. The `.ini` bounds alone fix the viewport.
`map.png` is still served at `/api/track-map/image`, but the web app **deliberately never draws
it** — AC strokes it at constant width around the AI line, misrepresenting track limits; the
driven lines are the track. Tracks without a `map.ini` fall back to an auto-fit view of the
driven line. The AC install itself is resolved once in `content/acPath.ts` (`AC_PATH` env var, else
the Steam library configs), shared by the track and car modules.

**Car assets (`bridge/src/content/carAssets.ts`).** Resolves the car's advertised top speed from
`content/cars/<car>/ui/ui_car.json` (→ `topSpeedKmh` on `SessionInfo`, used to scale the
speedometer dial). These files routinely contain raw control characters that break `JSON.parse`,
so the field is regex-scanned out of the text — same garbage-tolerant philosophy as `parsers.ts`.

**Type contract (`packages/protocol`).** The wire format is declared once, in the types-only
workspace package `@rivazza/protocol`, and both sides `import type` from it. The `BridgeMessage`
union (`status` | `session` | `telemetry` | `cut`) is the wire format. The package has no build
step: its `exports` point at the `.ts` source, and each side's own compiler checks it. Never
re-declare a wire type locally. A local copy compiles and breaks at runtime.

**Web data flow.** `useTelemetry` (`web/src/hooks/useTelemetry.ts`) owns the WebSocket (auto-reconnect
every 1.5s) and exposes telemetry two ways: React state (`telemetry`) for normal components, and a
`telemetryRef` for `requestAnimationFrame` loops (the track map) that must read every frame without
triggering re-renders. When adding high-frequency canvas visuals, read the ref, not the state.

**Derived-data hooks (`web/src/hooks/`).** `useInputHistory` (G-force ring buffer), `useLapHistory`
(session lap log), and `useLapDelta` (live delta vs. fastest recorded lap) all follow the same
pattern: bookkeeping in an effect keyed on the throttled `telemetry` state, result exposed as a
ref so canvas rAF loops can read it. AC's protocol sends no lap list and no invalid-lap flag, so
`useLapHistory` reconstructs laps from `lapCount` ticks and infers validity heuristically (a
would-be PB the game didn't adopt = cut lap; pit-lane touch = invalid), with shared-memory cut
events as the authoritative override when available. Also note: AC's "restart
session" does **not** re-handshake — restarts are detected by the lap counter or lap clock running
backwards, a signature duplicated in `useLapHistory`, `useLapDelta`, and `TrackMap`
(`TrackMap/lineRecorder.ts`). Keep them in sync if you change one.

**Track map projection (`web/src/components/TrackMap/`).** `pixel = (world + OFFSET) / SCALE_FACTOR`
from `map.ini`. If the dot appears mirrored on some track, flip the X term in `metaProjection`
(`TrackMap/projection.ts`). The map draws
pedal-colored driving lines (coast→throttle/brake color lerp) for the current lap, keeps a bounded
per-lap history with identity colors, and layers cursor-anchored wheel zoom over the base fit
projection. From the second wheel notch in (follow not tracking, fixed-fit modes only) an overview inset in the
top-right corner navigates the zoomed view at constant zoom: a ~250 ms cursor rest on it glides the
view there — one more writer of `zoomRef`, like the follow cam (`web/src/components/TrackMap/overviewInset.ts`
holds its geometry). All canvas components (`TrackMap`, `GForceMeter`) dirty-gate their rAF
loops — they only repaint when what's rendered actually changed. Preserve this when editing them.

**TrackMap's layout.** `index.tsx` is wiring: it owns the one rAF loop and its one dirty-gate
expression, and every other job is a sibling module. State that must outlive the render effect
(which re-runs when map data arrives) lives in component-level stable objects created once with
`useState`: the line recorder (`lineRecorder.ts`: samples, stored laps, lap counter, cut cursor)
and follow control (`useFollowControl.ts`). Everything scoped to one map is an effect-level
`create…` factory, called once per effect with the refs it reads: `camera.ts`, `markers.ts`,
`layers.ts` (offscreen layer caches), `hitTest.ts` and `gestures.ts`. The pieces communicate
only through refs (`zoomRef`, `navRef`, `insetRef`, …), never through a primitive captured at
creation. A new repaint input is one more term in the gate in `index.tsx`, not a flag in a module.

## Where the rest of the guidance lives

Cross-cutting conventions live in `.claude/rules/`, loaded by Claude Code without an import — read
them there rather than restating them here:

- **`git-workflow.md`** — commit format, the type→emoji table, branch creation. Loads every session.
- **`comments.md`** — when a comment is allowed at all. Loads every session; the PostToolUse hook
  `.claude/comment-check.ps1` flags each comment line an edit adds.
- **`code-style.md`** — functions, imports, types and file layout, Tailwind tokens.
  Loads only for `{bridge,web}/src/**`, `bridge/scripts/**`, `web/*.ts` and `packages/*/src/**`.
- **`verification.md`** — what "verified" means in a repo with no test framework. Loads every session.

Per-repo command configuration (branch conventions, the check commands `/opsx:verify` runs) is
`.claude/workflow.yaml`. The authoritative record of behaviour is `openspec/specs/`.

## Spec workflow

This project uses **OpenSpec** (spec-driven). Live specs are in `openspec/specs/`; changes are
proposed/applied/archived via the `/opsx:*` commands in `.claude/commands/opsx/` — `explore`,
`propose`, `apply`, `verify`, `sync`, `archive`, plus `tweak` (small delta-only changes) and
`audit-drift` (spec maintenance). Consult the relevant spec in `openspec/specs/` before changing a
documented feature.
