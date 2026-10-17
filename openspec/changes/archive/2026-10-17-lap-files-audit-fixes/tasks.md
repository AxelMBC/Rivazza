# Fix the lap files audit findings: unjudged laps counted as valid, cuts dropped after the line, duplicated lap rules, and split LapTimes

## 1. Behaviour fixes

- [x] 1.1 In `lib/lapAnalysis.ts`, replace `notValidLapSet` with a valid-only `validLapSet`. Use it in `resolveReference` and `bestSectors`, and make `sectorOwners` skip recordings with no `LapRecord`.
- [x] 1.2 In `LapTimes.tsx`, delete the `judgedLaps` filter and call `resolveReference(recordingsRef.current, laps)` directly.
- [x] 1.3 In `useLapHistory`'s cut loop, `break` without advancing the cursor when `cut.lapCount > telemetry.lapCount`.
- [x] 1.4 In `useLapHistory`, increment `framesWaited` only when `telemetry` is a different object from the previous run's (ref-tracked).

## 2. Rule fixes and duplicates

- [x] 2.1 In `LapAnalysis/index.tsx`, hold the selected `LapRecording` in state and derive `selected` with `reviewableLaps.includes`. Delete the reset effect. `LapChips`' `onSelect` takes the recording.
- [x] 2.2 Give `useTelemetry`'s `BridgeMessage` switch a `never` default.
- [x] 2.3 Add `bestValidLapMs(laps)` to `lib/lapStatus.ts`. Use it in `LapTimes` (computed once, passed to `LapListPanel`) and in `LapAnalysis/index.tsx`.
- [x] 2.4 Add `web/src/components/LapStatusChip.tsx` on `lapStatusTag`. Use it in `TimeTile`'s INV mark, the session lap list, `LapChips` and `TrackMap/LapLegend.tsx` (still pit-only there).
- [x] 2.5 Move `formatDelta` to `lib/format.ts` with a U+2212 minus. Use it in the delta tile and in `scrubOverlay.ts`'s `Δ …s` row.

## 3. Structure

- [x] 3.1 Add `isLastLapFresh(frame, pending, maxFrames)` to `lib/lapTransition.ts`. Use it in `useLapHistory` and `useLapRecordings`, and keep each hook's budget constant.
- [x] 3.2 Add `coversLap(samples)` to `lib/lapAnalysis.ts`. Use it for `rec.complete` and the wrap's `spansLap` in `useLapRecordings`.
- [x] 3.3 Split `LapTimes.tsx` into `LapTimes/index.tsx` (wiring, `TimeTile`, `liveDeltaMs`), `LapTimes/LapListPanel.tsx` and `LapTimes/bestLap.ts` (`displayedBestLapMs`).
- [x] 3.4 Add `web/src/components/RevealPanel.tsx` for the popover wrapper. Use it for the session lap list and the lap-analysis panel, and keep each caller's opening logic.

## 4. Verification

- [x] 4.1 Run `/axl:verify`
- [x] 4.2 In AC, cut a corner to set a lap faster than your best valid lap. When you cross the line, the analysis header never reads "vs Lap N (ref)" for that lap, and the theoretical best and the map's sector owners never use it.
- [x] 4.3 In AC, put four wheels off within a second of crossing the line. The Current-lap tile shows INV, and that lap shows `inv` in the session lap list when it completes.
- [x] 4.4 Hover the Last/Best tiles and the Lap-analysis tile in the live build. Both panels reveal and hide as before. Chips read `inv`/`out`/`in` in the same colours. The delta tile shows `−0.12`-style values with the same minus as the scrub readout.
- [x] 4.5 With a lap selected in the analysis panel, restart the session. After the next lap, the panel shows the latest lap rather than a stale selection.
