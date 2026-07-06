## 1. Bridge — shared-memory cut detection

- [x] 1.1 Add `koffi` to `bridge/package.json` dependencies and install; confirm `npm run build -w bridge` (tsc --noEmit) still passes
- [x] 1.2 Add `CutEvent` and the `{ type: 'cut' }` union member to `bridge/src/types.ts`
- [x] 1.3 Create `bridge/src/sharedMemory.ts`: koffi kernel32 declarations (`OpenFileMappingW`/`MapViewOfFile`/`RtlMoveMemory`/`CloseHandle`, HANDLEs as intptr), open with 3 s retry + close lifecycle, 16 ms poll copying 256 bytes into a Buffer and reading offsets 0/28/244 (`packetId`/`speedKmh`/`numberOfTyresOut`), frozen-`packetId` skip, `<4 → ≥4` onset edge with re-arm, emission gates (live session + latest frame + `!inPit` + speed ≥ 10 km/h), all behind a win32 + `AC_SHM` guard with try/catch dynamic import
- [x] 1.4 Wire the detector into `bridge/src/index.ts` (frame/session accessors, broadcast `cut` messages, stop on shutdown, single availability log lines)

## 2. Mock — simulated excursions

- [x] 2.1 Extend `bridge/scripts/mock-ac.js`: create and write the `Local\acpmf_physics` mapping (`CreateFileMappingW` with INVALID_HANDLE_VALUE, `MapViewOfFile` write, `RtlMoveMemory` from a staging buffer) with advancing `packetId`, mirrored speed, and `numberOfTyresOut = 4` for ~0.6 s roughly twice per mock lap; silent one-line skip when the platform or koffi can't support it

## 3. Web — cut event plumbing

- [x] 3.1 Mirror `CutEvent` and the new union member in `web/src/types.ts`
- [x] 3.2 `useTelemetry`: handle `cut` messages — append to a session-scoped `cutsRef`, bump a `cutSeq` state, replace the array wherever telemetry clears today (session change / waiting), and expose both
- [x] 3.3 `useLapHistory`: accept `cutsRef`/`cutSeq`, consume incrementally (reset consumed index on array identity change), flag the in-progress lap on a matching cut, mark a pending completed record when its cut arrives late, record `invalid: pitDuring || rejected || cutDuring`, and return `{ lapsRef, currentLapInvalidRef }`; update `App.tsx` threading

## 4. Web — markers and live cue

- [x] 4.1 `TrackMap`: accept `cutsRef`; consume cuts inside the draw loop (current lap → current markers, stored lap → its entry, otherwise drop), store markers with lap entries, clear in `resetLines`, and include the cut list (length + identity) in the dirty check
- [x] 4.2 `TrackMap`: draw × markers (INVALID_TIME red over a SURFACE halo, ~5 px half-arm, constant screen size via the existing screen-space projection) above the lap layers and below the car dot — ambient for the current lap + colored window, hovered grey laps included in the emphasis pass
- [x] 4.3 `LapTimes`: Current-lap tile renders critical color + small "INV" chip while `currentLapInvalidRef` is set
- [x] 4.4 Rework marker visibility (feedback from the real-game run): ambient × only while the invalid lap is in progress; stored laps reveal markers only when hovering their map line or their "Lap N inv" row in the session-lap list (shared `hoveredLapRef`, dirty-gated in the map's rAF loop)

## 5. Docs and verification

- [x] 5.1 Document `AC_SHM` and the shared-memory reader in `CLAUDE.md` (bridge config + architecture sections)
- [x] 5.2 Type-check both workspaces (`npm run build -w bridge`, `npm run build -w web`) and `npm run lint -w web`
- [x] 5.3 Run bridge + mock on Windows: periodic `cut` messages arrive, markers land at the mock car's position, colored-window/hover visibility behaves, restart clears markers, idle map stays idle
- [x] 5.4 Verify against the real game: drive a deliberate 4-wheels-off cut — marker appears at the spot the moment AC flags the cut, the lap records invalid (including the slower-than-best case), `AC_SHM=0` disables cleanly, and starting the bridge before AC retries until the mapping opens
