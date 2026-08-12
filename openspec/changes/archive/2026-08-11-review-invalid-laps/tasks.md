## 1. Sector ownership derivation

- [x] 1.1 Add `SectorOwner` type and `sectorOwners(recordings, laps, count)` to
      `web/src/lib/lapAnalysis.ts`, returning per slice the lap with the lowest recorded time
      across **all** complete recordings plus its time and `invalid` flag, `null` where no lap
      covers the slice, with a deterministic tie-break
- [x] 1.2 Confirm `bestSectors` and `theoreticalBestMs` are left behaviorally unchanged
      (valid-only) and that `sectorOwners` feeds neither

## 2. Invalid laps in the selection list

- [x] 2.1 Drop the invalid filter from `reviewableLaps` in `LapAnalysis.tsx` so it is every
      complete recording; keep the invalid set for marking only
- [x] 2.2 Add the `INV` tag beside the lap number on invalid chips, matching `LapTimes.tsx`'s
      cue; the existing `text-critical` time styling becomes reachable as-is
- [x] 2.3 Mark an invalid selected lap in the panel header in the critical tone
- [x] 2.4 Verify the sticky-selection effect keeps an invalid lap selected (it must no longer
      reset on invalidation) and still falls back to follow-latest on eviction
- [x] 2.5 Update the collapsed bar: lap count covers the full list, session best stays
      valid-only, and remove the now-unreachable "no valid laps yet" branch

## 3. No-reference delta strip

- [x] 3.1 In `renderTraces`, replace the delta strip's `±Xs` caption with a "no valid reference"
      caption in the caption tone when `ref === null`
- [x] 3.2 Check the empty state now triggers on "no complete recordings" rather than "no
      reviewable laps", and reword its message accordingly
- [x] 3.3 Confirm the layer key already covers the no-reference case (it includes
      `ref?.lap ?? -1`) so the dirty-gate needs no change

## 4. Sector ownership ribbon

- [x] 4.1 Replace `sectorClass` with owner-based coloring: `lapColor(owner.lap)` for a valid
      owner, the `critical` token for an invalid owner, `bg-hairline` when unowned
- [x] 4.2 Render the ribbon from `sectorOwners` instead of `selectedSectors`, making it
      independent of the selected lap; remove the now-unused selected-lap sector comparison
      (`selectedSectors`, `selectedValid`, `SECTOR_TOLERANCE_MS` usage) if nothing else needs it
- [x] 4.3 Increase the strip height (from `h-1.5` toward `h-3`) so 24 hues are separable within
      the panel's `max-h-[42vh]` budget
- [x] 4.4 Add the per-slice hover readout naming slice, owning lap, sector time, and invalidity,
      using `onMouseEnter`/`onMouseLeave` plus the `isImmediateActivation` touch path like the
      chip rows — hover-only, no click or focus in live builds
- [x] 4.5 Clear the readout when the pointer leaves the strip

## 5. Verification

- [x] 5.1 `npm run lint -w web` and `npm run build -w web` clean; `npm run format:check` clean
- [x] 5.2 Run the mock (`npm run mock -w bridge` + `npm run dev`) and drive the panel per the
      `verify` skill: invalid laps listed and selectable, `INV` cues present, selection defaults
      to the latest complete lap including an invalid one
- [x] 5.3 Confirm selecting an invalid lap reveals its line and cut markers on the track map
- [x] 5.4 Confirm the ribbon shows identity colors per owner, red where an invalid lap owns a
      slice, and does not change when a different lap is hovered
- [x] 5.5 Confirm Theoretical and Session best are unaffected by invalid-owned slices
- [x] 5.6 Force an all-invalid session and confirm the panel lists the laps, renders speed and
      pedal traces, and shows the "no valid reference" delta caption with no session best
- [x] 5.7 Check the demo build's click mode still drives chips and the sector readout
