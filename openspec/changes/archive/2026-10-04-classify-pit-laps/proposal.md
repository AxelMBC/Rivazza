## Why

A clean lap that starts or ends in the pit lane is recorded `invalid` (`useLapHistory.ts:119`), so it gets the same red INV as a lap cut through the track limits. Sector ownership counts invalid laps too (`lib/lapAnalysis.ts:147-162`), so right after a pit spawn the out-lap is the only lap and owns every sector: the map reads "S1 · L1 INV" … "S8 · L1 INV" in red, and the analysis ribbon shows it the same way.

## What Changes

- `LapRecord.invalid: boolean` becomes `LapRecord.status: 'valid' | 'invalid' | 'out' | 'in'`. **BREAKING** for every consumer of the field (web only, not the wire contract).
- `invalid` now means only that the game invalidated the lap: a cut event, or the would-be-best heuristic. A lap that touched the pit lane is a **pit lap**: `out` when `inPit` was set on the lap's first frame, otherwise `in`.
- Verdict precedence: a cut event > pit lap > rejected-best heuristic > valid. A pit stop explains why the game didn't adopt the lap as best, so the heuristic can't make an out-lap red. A real cut on an out-lap is still invalid.
- Pit laps stay out of everything "best": the Best-lap tile, session best, best sectors, theoretical best, the reference lap and the live delta.
- Pit laps own no sectors, on the map labels or in the analysis ribbon.
- Pit laps show an `OUT`/`IN` tag in the secondary-ink tone wherever an invalid lap shows `INV`, and their time renders in the secondary-ink tone. Red stays for invalid laps only.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lap-history`: the record shape, invalidity rules, pit-lap classification, how the session lap list and map hover label show pit laps, and which laps the Best-lap tile can override.
- `mini-sector-timing`: the ownership table leaves pit laps out.
- `track-sector-division`: sectors fill in from the first lap that isn't a pit lap.
- `lap-analysis`: the selection list and the panel header show pit laps with their tag, not as invalid.
- `lap-line-comparison`: the map legend shows pit laps with their tag in the neutral tone.
- `racer-dashboard`: the live delta reference is the fastest lap marked valid, not "not marked invalid".

## Out of Scope

- A live OUT/IN cue on the Current-lap tile while the pit lap is in progress. The tile's INV cue stays cut-only.
- Per-slice pit exclusion (keeping an in-lap's fast early sectors). It would need `inPit` on every recorded sample.
- Any bridge or wire-protocol change. `inPit` is already on every telemetry frame.

## Impact

- `web/src/hooks/useLapHistory.ts`: the `LapRecord` type, the pending-lap verdict, tracking `inPit` on the lap's first frame.
- `web/src/lib/lapAnalysis.ts`: the not-valid set for best/reference, and pit laps left out of `sectorOwners`.
- `web/src/hooks/useLapRecordings.ts`: the eviction guard keeps the fastest valid lap.
- `web/src/components/LapTimes.tsx`: the lap list tag and tone, the valid-best list, and the Best-lap override.
- `web/src/components/LapAnalysis/`: `index.tsx` (header, session best) and `LapChips.tsx`.
- `web/src/components/TrackMap/`: `index.tsx` (legend) and `hitTest.ts` (hover label colour).
