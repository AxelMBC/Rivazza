## Context

`useLapHistory` collapses three unrelated signals into `LapRecord.invalid` (`useLapHistory.ts:119`): a cut event, a pit-lane frame, and the rejected-best heuristic. The field has about 15 consumers, and each one asks one of two questions:

- **Can this lap be a best/reference?** `LapTimes.tsx:58,159,168`, `lib/lapAnalysis.ts:85` (`resolveReference`, `bestSectors`), `useLapRecordings.ts:144` (eviction guard), `LapAnalysis/index.tsx:186`.
- **Should it be painted as invalid?** `LapTimes.tsx:102,111`, `LapChips.tsx:44,52`, `LapAnalysis/index.tsx:185,211-213`, `TrackMap/index.tsx:269-274,509`, `TrackMap/hitTest.ts:127`, plus the owner-level flag in `markers.ts:113,122`, `scrubOverlay.ts:57,64`, `traceLayer.ts:83,86` and `constants.ts:47`.

`sectorOwners` (`lib/lapAnalysis.ts:147-162`) takes every recording. After a pit spawn, the out-lap is the only one, so it owns every slice.

## Goals / Non-Goals

**Goals:** pit laps are never red and never own a sector, and they still never count as best. Each consumer asks its question explicitly.

**Non-Goals:** a live OUT cue on the Current-lap tile, and per-slice pit exclusion.

## Decisions

### 1. One `status` union, not a second boolean

`LapRecord` becomes `{ lap, timeMs, status: 'valid' | 'invalid' | 'out' | 'in' }`. Pit laps are deliberately not a sub-kind of invalid: they need their own tag and their own ownership rule.

Considered: keep `invalid` and add `pit: boolean`. Two booleans allow the meaningless "pit but valid" state, and every "excluded from best" site would have to remember to check both. With the union, each site has one check: `status !== 'valid'` for best/reference/eviction, `status === 'invalid'` for red, and `status === 'out' || status === 'in'` for the tag and for ownership.

### 2. Verdict precedence: cut event > pit > rejected-best heuristic > valid

The verdict is computed once, when the pending lap settles:

```
cutDuring        → 'invalid'
pitDuring        → pitAtStart ? 'out' : 'in'
rejected         → 'invalid'
otherwise        → 'valid'
```

The heuristic only stands in for an undetected cut. On a pit lap, the pit lane already explains why the game didn't adopt the lap as best. Without this order, an out-lap with no prior best (`bestBefore <= 0` and `bestLapMs` stays 0) would still be painted red, which is the bug.

### 3. OUT vs IN from the lap's first frame

A new ref, `pitAtStartRef`, is set from `telemetry.inPit` on the frame where a new lap begins (the `lapCount` increment, or the first frame after connecting, a restart or the `!telemetry` reset). It is copied into `PendingLap` next to `pitDuring`. A lap that starts and ends in the pit lane is `out`. Only one extra boolean is held per lap, and nothing is added per sample.

### 4. Ownership leaves pit laps out entirely; `SectorOwner.invalid` stays a boolean

`sectorOwners` skips recordings whose lap is a pit lap. Owners can therefore only be valid or invalid laps, so `SectorOwner.invalid` keeps its meaning (`status === 'invalid'`), and the map labels, ribbon, scrub readout and `ownersKey` keep working unchanged. The map's `syncSectorTables` key (`recordingsVersion | laps.length`) still catches a status that lands after the recording, because a lap's record is appended once, with its final status.

Considered: excluding only the slices driven in the pit lane, which would keep an in-lap's fast early sectors. That needs `inPit` on every `LapTelemetrySample` (30 laps × 12k samples) and changes what ownership means. It was rejected as out of scope.

### 5. Tag rendering

Three DOM sites render the tag: the session list in `LapTimes.tsx`, `LapChips.tsx`, and the analysis header. The map legend becomes a fourth. Each one maps `status` to `INV` (critical), `OUT`/`IN` (`text-ink-secondary`) or nothing. Once that mapping has a second consumer, a small shared helper for status → tag text and tone class goes in `web/src/lib/` (the features can't import from each other). On the canvas side, the map hover label needs a neutral colour for pit-lap times, next to `INVALID_TIME` in the TrackMap constants.

## Risks / Trade-offs

- The order of AC's pit-spawn frames is unverified. If `inPit` reads false on the very first frame of a pit spawn, the out-lap would be classified `in`. It would still not be red and still own no sectors, so the main symptom is fixed regardless. → The manual check covers it.
- A drive-through or stop-go lap that starts on track is classified `in`. → Accepted. It is still neutral, never best and owns no sectors.

## Open Questions

- none
