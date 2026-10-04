# Classify pit laps as OUT/IN instead of invalid, and keep them out of sector ownership

## 1. Lap log

- [x] 1.1 In `web/src/hooks/useLapHistory.ts`, replace `LapRecord.invalid` with `status: 'valid' | 'invalid' | 'out' | 'in'` (an `as const` object plus a derived union, no `enum`)
- [x] 1.2 Add `pitAtStartRef`: set it from `telemetry.inPit` on the frame a new lap begins (`lapCount` increment, first frame after connect, restart or reset), and carry it in `PendingLap`
- [x] 1.3 Compute the settled verdict in the order cut event > pit (`out` if the lap started in the pit lane, else `in`) > rejected-best heuristic > valid

## 2. Best / reference consumers (`status !== 'valid'` is excluded)

- [x] 2.1 `web/src/lib/lapAnalysis.ts`: turn `invalidLapSet` into a not-valid set used by `resolveReference` and `bestSectors`
- [x] 2.2 `web/src/lib/lapAnalysis.ts`: `sectorOwners` skips pit laps, and `SectorOwner.invalid` becomes `status === 'invalid'`
- [x] 2.3 `web/src/hooks/useLapRecordings.ts`: the eviction guard keeps the fastest lap marked valid (reuses `resolveReference`, which had the same logic)
- [x] 2.4 `web/src/components/LapTimes.tsx`: build valid-best from `status === 'valid'`, and have the Best-lap override (`gameBestInvalid`) also cover pit laps
- [x] 2.5 `web/src/components/LapAnalysis/index.tsx`: session best from valid laps only

## 3. Display (red only for `invalid`, OUT/IN tag in `text-ink-secondary` for pit laps)

- [x] 3.1 Add a shared status → tag text and tone helper in `web/src/lib/`, used by every DOM site below
- [x] 3.2 `LapTimes.tsx` session lap list: tag and time tone per status
- [x] 3.3 `LapAnalysis/LapChips.tsx`: tag and time tone per status
- [x] 3.4 `LapAnalysis/index.tsx` header: critical `(inv)` only for invalid, `OUT`/`IN` in secondary ink for pit laps
- [x] 3.5 `TrackMap/index.tsx` legend: carry `status` in the entries and in the legend key, and show the tag for pit laps
- [x] 3.6 `TrackMap/hitTest.ts` hover label: critical colour for invalid, and a new neutral constant beside `INVALID_TIME` for pit laps

## 4. Verification

- [x] 4.1 Run `/axl:verify`
- [x] 4.2 In AC, start a practice session in the pits and drive a clean lap from the pit box: the session lap list shows `Lap 1 OUT` with its time in grey (no red), the map sector labels read `S1`…`S8` with no lap named, and the analysis ribbon is all inert
- [x] 4.3 Drive one flying lap without cutting: the map sector labels name `L2` in its identity colour, the Best-lap tile and the delta use lap 2, and lap 1 stays `OUT`
- [x] 4.4 Cut a corner on the next lap: that lap shows red `INV` in both lap lists and on any sector it owns
- [x] 4.5 Enter the pit lane before the line to end a lap: that lap shows `IN` in grey, never owns a sector, and the lap that starts from the pit lane afterwards shows `OUT`
