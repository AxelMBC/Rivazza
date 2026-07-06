# Detect lap invalidation from AC shared memory and mark cuts on the track map

## Why

AC's remote telemetry UDP protocol carries no lap-validity signal, so validity today is
inferred after the fact from heuristics (a would-be PB the game didn't adopt, a pit-lane
touch) — with a documented accepted miss (cut laps slower than best read as valid) and no
way to say *where* a lap was lost. The game itself publishes the answer live: the
`Local\acpmf_physics` memory-mapped page includes `numberOfTyresOut`, the exact counter AC
uses to invalidate laps (4 tyres out). Polling it alongside the UDP stream pins the moment
of invalidation, and the car position already streaming per frame pins the spot — so the
mistake can be marked right on the accurate track edges the map now draws.

## What Changes

- The bridge gains a Windows shared-memory reader for AC's physics page: a small FFI
  dependency (`koffi`, prebuilt binaries — the repo's first native dep) calls
  `OpenFileMappingW`/`MapViewOfFile`, and the page is read at ~60 Hz with the same
  offset-based Buffer parsing style as `parsers.ts`.
- Cut onset detection: a transition of `numberOfTyresOut` from < 4 to ≥ 4, gated by an
  advancing physics `packetId` (game unpaused), a live UDP session, a minimum speed, and
  not being in the pits. One event per excursion.
- New additive `{ type: 'cut', ... }` message on the existing WebSocket, carrying the lap
  counter, lap clock, world position, speed, and tyre count at the moment of the cut
  (type contract mirrored in both `types.ts`).
- The track map draws an × marker at each cut's exact world position — for the current
  lap, the recent identity-colored laps, and any hovered stored lap — at constant screen
  size across zoom, preserving the dirty-gated rAF loop.
- Lap validity becomes authoritative when cut events arrive: a lap with a cut is recorded
  invalid regardless of heuristics (closing the "cut lap slower than best" gap), and the
  Current-lap tile shows a live invalid state the moment the in-progress lap dies.
- The mock simulates the whole path on Windows: it creates and writes the real
  `Local\acpmf_physics` mapping with periodic 4-tyres-out excursions, so cut detection is
  exercisable end to end without the game.
- Everything degrades silently to today's behavior when shared memory is unavailable:
  non-Windows, `AC_SHM=0`, koffi load failure, or AC running on another machine
  (`AC_HOST` remote — shared memory is same-PC only).

## Capabilities

### New Capabilities

- `cut-detection`: bridge-side reading of AC's physics shared-memory page, cut onset
  detection and gating, the `cut` WebSocket message, graceful platform degradation, and
  mock simulation of the mapping.
- `cut-markers`: rendering detected cuts as position markers on the track map — per-lap
  association, visibility window (current + colored + hovered laps), and session/restart
  reset semantics.

### Modified Capabilities

- `lap-history`: the "Heuristic lap invalidity" requirement is extended — a cut event
  received during a lap marks it invalid authoritatively (heuristics remain as fallback);
  a new requirement adds live invalid indication for the in-progress lap on the
  Current-lap tile.

## Impact

- `bridge/src/sharedMemory.ts` (new) — koffi mapping reader + cut detector.
- `bridge/src/index.ts` — wire the detector to the latest frame/session state; broadcast
  `cut` messages.
- `bridge/src/types.ts` + `web/src/types.ts` — mirrored `CutEvent` type and new
  `BridgeMessage` union member.
- `bridge/package.json` — new dependency `koffi` (prebuilt, no build toolchain).
- `bridge/scripts/mock-ac.js` — create/write the physics mapping with simulated
  excursions (Windows only; skips silently elsewhere).
- `web/src/hooks/useTelemetry.ts` — handle `cut` messages (ref + rare state signal).
- `web/src/hooks/useLapHistory.ts` — consume cuts for authoritative validity; expose
  current-lap invalid state.
- `web/src/components/TrackMap.tsx` — cut markers; `web/src/components/LapTimes.tsx` —
  live invalid cue; `web/src/App.tsx` — threading.
- `CLAUDE.md` — document `AC_SHM` and the shared-memory reader.
- Wire format additive only; no breaking changes. Feature is Windows-only by nature; all
  other paths unchanged.
