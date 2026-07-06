# Design — lap invalidation from AC shared memory, cut markers on the map

## Context

The remote telemetry UDP protocol the bridge speaks has no lap-validity signal, so
`useLapHistory` infers validity after a lap completes (would-be-PB rejected, pit touch)
with a documented miss: cut laps slower than best read as valid. And no heuristic can
say *where* a lap died.

AC also publishes memory-mapped pages on the local machine — the same interface SimHub
and Crew Chief read. `Local\acpmf_physics` (struct `SPageFilePhysics`, `#pragma pack(4)`,
updated every physics tick at ~333 Hz) contains `numberOfTyresOut`: the game's own live
count of wheels beyond track limits, the counter behind its 4-tyres-out lap invalidation.
Every member before it is a 4-byte scalar or float array, so its offset is
alignment-stable across the fields we need:

| field              | offset | type    |
| ------------------ | ------ | ------- |
| `packetId`         | 0      | int32   |
| `speedKmh`         | 28     | float32 |
| `numberOfTyresOut` | 244    | int32   |

Node cannot open Windows shared memory natively; this repo currently has zero native
dependencies. The UDP stream already delivers the car's world position every frame, so
pairing "the moment `numberOfTyresOut` hits 4" with "the newest RTCarInfo position"
yields the cut location without reading anything else from shared memory.

## Goals / Non-Goals

**Goals:**

- Detect the exact moment a lap becomes invalid (4 tyres out) from the game's own
  counter, and mark the spot on the track map — on the accurate track edges the map
  already draws.
- Make lap validity authoritative when cut events exist; keep today's heuristics as the
  fallback (they still catch pit touches and anything shared memory misses).
- Zero behavior change when shared memory is unavailable (non-Windows, `AC_SHM=0`,
  koffi failure, AC on another PC). The UDP path's throughput and the dirty-gated
  render loops stay untouched.
- Keep the whole path exercisable without the game via the mock.

**Non-Goals:**

- Reading the graphics/static shared-memory pages. `acpmf_graphics` has
  `carCoordinates`/`isInPitLane`, but its layout interleaves wchar arrays (offset
  fragility) and the UDP stream already carries position, pit state, and lap data.
  One page, three fields.
- A live "tyres out" HUD readout, or a capability flag on the session message. Markers
  and validity are the product; absence of events is indistinguishable from clean
  driving by design.
- Excluding cut laps from the live-delta reference (`useLapDelta` unchanged) — a
  worthwhile follow-up, but a separate concern from detection and marking.
- Pit-lane invalidation markers: a pit touch has no single meaningful location; it
  already flags the lap via the existing heuristic.
- Catching sub-sample cut blips (see Risks).

## Decisions

### 1. Physics page only; position stamped from the newest UDP frame

`numberOfTyresOut` is the trigger; position, lap counter, lap clock, and `inPit` come
from the bridge's `latestFrame` (RTCarInfo). At 60 Hz+ packet arrival the stamped
position is at most ~16 ms stale — ~1 m at 250 km/h, sub-pixel at map scale.
Alternative rejected: mapping `acpmf_graphics` for exact `carCoordinates` — a second
mapping and wchar-packed offsets for a gain below rendering resolution.

### 2. FFI via koffi; offset-based Buffer reads in the parsers.ts style

`koffi` ships prebuilt binaries (no build toolchain — important for a repo with no
native deps today). A new `bridge/src/sharedMemory.ts` declares four kernel32 calls:
`OpenFileMappingW` (`FILE_MAP_READ`), `MapViewOfFile`, `RtlMoveMemory`, `CloseHandle`.
Each poll copies the first 256 bytes of the view into a Node `Buffer` via
`RtlMoveMemory`, then reads fields with `readInt32LE`/`readFloatLE` at named offset
constants — the same magic-number philosophy as `parsers.ts`, no koffi struct types.
HANDLE/view parameters are declared pointer-sized-integer (`intptr`) so the mock can
pass `INVALID_HANDLE_VALUE` (−1) to `CreateFileMappingW` without pointer gymnastics.

koffi loads via dynamic `import()` behind `process.platform === 'win32' &&
process.env.AC_SHM !== '0'`, wrapped in try/catch → reader is `null` and the feature
is off. Alternatives rejected: `ffi-napi` (unmaintained, N-API breakage history), a
custom native addon (build toolchain), a PowerShell sidecar (slow, fragile parsing).

### 3. Polling loop with edge detection, heavily gated

A 16 ms `setInterval` (~60–64 Hz effective on Windows' 15.6 ms timer floor). Each tick:

- Read `packetId`; if unchanged since the last tick, do nothing — a frozen page means
  paused, menus, replay, or a closed game, and consuming no sample means no false
  transitions.
- Onset = previous `numberOfTyresOut` < 4 and current ≥ 4, evaluated only across fresh
  packet ids. Emit at most one event per excursion; re-arm when the count drops below 4.
- Emission gates: a live session exists, a `latestFrame` is present, `frame.inPit` is
  false, and shared-memory `speedKmh` ≥ 10 (garage/teleport guard).

Mapping lifecycle: attempt `OpenFileMappingW` at startup and retry every 3 s while it
fails (mirrors the handshake retry cadence); once mapped, keep the view for the process
lifetime — if AC restarts it reopens the same named section, so the view stays valid.
One log line when the mapping opens; one when it is unavailable at startup; no spam.

### 4. Wire format: additive `cut` message

```ts
export type CutEvent = {
  lapCount: number;   // raw AC lap counter at the cut (display convention: lap N+1)
  lapTimeMs: number;  // lap clock at the cut
  x: number;          // world position from the newest RTCarInfo frame
  z: number;
  speedKmh: number;
  tyresOut: number;   // counter value that fired the onset (>= 4)
};

export type BridgeMessage = ... | ({ type: 'cut' } & CutEvent);
```

Mirrored in both `types.ts`. Additive only: the web app's message switch ignores
unknown types, so old clients are unaffected.

### 5. Web data flow: cuts ref + sequence state in `useTelemetry`

`useTelemetry` appends `cut` messages to a session-scoped `cutsRef` array and bumps a
`cutSeq` counter state (cuts are rare — a state update per cut is negligible). The
array is replaced with a fresh one wherever telemetry is cleared today (session change,
waiting). Consumers keep their own consumed index and detect list replacement by array
identity — the established ref-for-rAF / state-for-effects split.

- `useLapHistory(telemetry, cutsRef, cutSeq)` consumes new cuts in its effect: a cut
  whose `lapCount` matches the in-progress lap sets a current-lap-cut flag; one
  matching a just-completed lap still pending marks that pending record. Completed
  records become `invalid: pitDuring || rejected || cutDuring`. The hook now returns
  `{ lapsRef, currentLapInvalidRef }` (components already read `lapsRef.current`
  during render — same precedent). Restart/reset clears the flag and the index.
- `TrackMap` receives `cutsRef` and consumes inside the draw loop: `cut.lapCount ===
  frame.lapCount` → current-lap marker list; matching a stored lap (`lap - 1 ===
  cut.lapCount`) → appended to that stored entry (late arrival across a lap
  boundary); anything else (restart leftovers) is dropped. `resetLines` clears
  current-lap markers; stored markers live and die with their lap entries. The dirty
  check adds the cuts array's length + identity, so a cut repaints even if frames
  pause.

### 6. Marker rendering: direct strokes, no new layer

Markers are few (a handful per session, bounded by the lap window), so they are stroked
directly on the main canvas every repaint — after the lap layers blit, before the car
dot — projecting each marker point through the existing `project`. Since the zoom
projection is screen-space, a fixed pixel geometry is automatically constant-size at
every zoom level. Style: an × cross (~5 px half-arm, ~2.5 px stroke) in the existing
`INVALID_TIME` red over a `SURFACE`-colored halo stroke for contrast on ribbon, lines,
or background.

Visibility: only the in-progress lap's markers are ambient — they leave the ambient
view with the lap at the line. Stored laps reveal theirs on demand: hovering the lap's
line on the map (the emphasis pass), or hovering its row in the Lap tile's session-lap
list. The list rows write the hovered lap number into a shared App-owned
`hoveredLapRef` that the map's rAF loop reads and dirty-gates on — cross-component
hover with zero re-renders, in the codebase's ref-for-rAF tradition.

### 7. Live invalid cue on the Current-lap tile

While `currentLapInvalidRef` is set, the Current-lap tile renders its time in
`text-critical` with the same small "INV" chip styling the lap list already uses.
Resets the moment a new lap starts (or on restart). No new component — a prop into
`LapTimes`.

### 8. Mock writes the real mapping

On win32 with koffi resolvable, `mock-ac.js` creates the same named mapping
(`CreateFileMappingW(INVALID_HANDLE_VALUE, …, PAGE_READWRITE, 800 bytes)` +
`MapViewOfFile(FILE_MAP_WRITE)`) and, on each UDP tick, `RtlMoveMemory`s a staging
buffer carrying an incrementing `packetId`, the mirrored mock speed, and
`numberOfTyresOut = 4` during a ~0.6 s window roughly twice per mock lap (0 otherwise).
The bridge's real reader path is exercised end to end without the game. On other
platforms (or koffi load failure) the mock logs one line and streams UDP exactly as
today.

## Risks / Trade-offs

- [Struct offsets wrong on some AC build] → offsets derive from the pack(4) layout with
  only 4-byte members before offset 244 — the layout every major AC tool hardcodes.
  The mock writes the same offsets, so a regression is visible in dev immediately; a
  real-game verification step is in tasks. Wrong data is bounded by the gates (frozen
  `packetId`, speed, pit) — worst case is a missing/spurious marker, never a crash.
- [koffi install/load failure] → bridge-only dependency, dynamic import in try/catch,
  one log line, feature off, everything else unchanged.
- [60 Hz sampling misses a 1–2-physics-tick blip] → a marginal cut might get no marker;
  the PB-rejection heuristic still flags the lap. Accepted — markers target
  human-visible mistakes.
- [Cut exactly on the start/finish line] → `lapCount` stamps from the newest frame, so
  the marker can attach to the neighbor lap. The world position is still exact; ±1 lap
  association only in that sliver.
- [False positives while stationary/teleporting] → advancing-`packetId` gate + ≥10 km/h
  + `!inPit` + live-session gates.
- [AC on another PC via `AC_HOST`] → `OpenFileMappingW` simply never succeeds; single
  log line; the UDP dashboard is unaffected.
- [Marker clutter on messy sessions] → ambient markers limited to the current lap and
  the colored-lap window; grey laps reveal on hover only.

## Migration Plan

Purely additive — no persisted data, no wire breakage (unknown message types are
ignored by the web switch today). Rollback is a revert; removing the koffi dependency
restores a zero-native-deps repo.

## Open Questions

None blocking. The speed gate (10 km/h) and the mock's excursion cadence are
implementation-time tunables.
