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

npm workspaces monorepo (`bridge`, `web`). Run from the repo root:

- `npm run dev` — starts bridge (:3001) and web app (:5173) together via concurrently
- `npm run build` — builds both workspaces
- `npm run mock -w bridge` — fake AC on UDP 9996 streaming a car lapping Magione, for developing without the game. **Stop it before running the real game** (both bind 9996).
- `npm run lint -w web` — oxlint (the only linter; the bridge has none)
- `npm run build -w bridge` — bridge "build" is `tsc --noEmit` (type-check only; it runs via `tsx`, never compiled to JS)
- `npm run build -w web` — `tsc -b && vite build`

There is **no test framework** in this repo — do not invent test commands.

## Bridge configuration (env vars)

`AC_PATH` (game folder for track maps; auto-discovered from Steam library configs if unset), `AC_HOST` (default `127.0.0.1`), `AC_PORT` (default `9996`), `BRIDGE_PORT` (default `3001`).

## Architecture

**Binary UDP protocol (`bridge/src/parsers.ts`).** The delicate core. AC sends fixed-size
little-endian structs at exact byte offsets: `HANDSHAKE_RESPONSE_SIZE = 408`,
`RT_CAR_INFO_SIZE = 328`. Message type is disambiguated purely by packet length. Offsets
encode MSVC struct alignment/padding — do not "clean up" the magic numbers. AC's UTF-16LE
strings are fixed 50-wchar buffers with trailing garbage (often a stray `%`); `readWideString`
cuts at the first control char or `%`. Corrupt strings here silently break track-folder lookups.

**Session lifecycle (`bridge/src/acClient.ts`).** `ACClient` runs handshake → subscribe →
RTCarInfo stream. AC never signals session end, so a stale timer (5s of silence) drops back to
handshaking and emits `waiting`. It retries the handshake every 3s while the game is closed.

**Throttling (`bridge/src/index.ts`).** AC floods RTCarInfo packets; the bridge keeps only the
newest frame and flushes to WebSocket clients at 60 Hz (needed for the track map's ~1 m line
sampling). On the web side, `useTelemetry` updates `telemetryRef` on every message but throttles
React state to ~30 Hz (with a trailing-edge flush), so text readouts re-render at half rate while
canvas rAF consumers keep full fidelity. New WS clients get a `hello` (current status + session)
on connect.

**Track assets (`bridge/src/trackAssets.ts`).** Reads `content/tracks/<track>/[<config>/]data/map.ini`
for projection bounds and the optional `map.png`. The `.ini` bounds alone are enough to fix the
viewport; the image is optional. Tracks with neither fall back to drawing the driven line.

**Type contract.** `bridge/src/types.ts` and `web/src/types.ts` are hand-mirrored and **must be
kept in sync** — the `BridgeMessage` union (`status` | `session` | `telemetry`) is the wire format
for both sides.

**Web data flow.** `useTelemetry` (`web/src/hooks/useTelemetry.ts`) owns the WebSocket (auto-reconnect
every 1.5s) and exposes telemetry two ways: React state (`telemetry`) for normal components, and a
`telemetryRef` for `requestAnimationFrame` loops (the track map) that must read every frame without
triggering re-renders. When adding high-frequency canvas visuals, read the ref, not the state.

**Track map projection (`web/src/components/TrackMap.tsx`).** `pixel = (world + OFFSET) / SCALE_FACTOR`
from `map.ini`. If the dot appears mirrored on some track, flip the X term in `project`. The map also
draws pedal-colored driving lines (coast→throttle/brake color lerp) and keeps a bounded history of laps.

## Conventions

- **All functions are arrow functions**, including React components. Match this everywhere.
- **Tailwind v4** with semantic design tokens defined in `web/src/index.css` `@theme` (e.g. `text-ink-muted`, `bg-surface`, `border-edge`, `text-critical`). Use the tokens, not raw hex/color values.
- React 19, Vite, strict TypeScript throughout.

## Spec workflow

This project uses **OpenSpec** (spec-driven). Live specs are in `openspec/specs/`; changes are
proposed/applied/archived via the `/opsx:*` skills (`propose`, `apply`, `archive`, `sync`, `explore`).
Consult the relevant spec in `openspec/specs/` before changing a documented feature.
