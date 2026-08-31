## 1. Layout

- [x] 1.1 Add a `RIBBON_H` constant to `LapAnalysis.tsx` (start at 12 px, matching today's `h-3`) with a short comment on why it is fixed rather than proportional.
- [x] 1.2 Extend `layoutStrips` to return a fourth `sectors: Strip`, subtracting `RIBBON_H` and a third `STRIP_GAP` from `avail` before splitting the remainder 0.42 / 0.24 / 0.34 across speed, pedals and delta.
- [x] 1.3 Grow the canvas wrapper's height classes (`h-24 lg:h-28`) by `RIBBON_H + STRIP_GAP` so the trace strips keep their current size.

## 2. Draw the ribbon into the cached trace layer

- [x] 2.1 Pass `owners` into the rAF effect through a ref (mirroring `selectedRef` / `referenceRef`), since it is derived on every render.
- [x] 2.2 In `renderTraces`, fill each of the `SECTOR_COUNT` slices across `plotX(i / SECTOR_COUNT)` → `plotX((i + 1) / SECTOR_COUNT)` at the `sectors` strip: `lapColor(owner.lap)` for a valid owner, the critical tone for an invalid one, the inert hairline tone for no owner.
- [x] 2.3 Keep the 1 px inter-slice separation the DOM `gap-px` gave, so boundaries stay readable at full width.
- [x] 2.4 Draw the `SECTORS` caption at `sectors.top - 4`, matching the other three captions.
- [x] 2.5 Confirm the ribbon does not force a layer rebuild on scrub frames. `version` turned out to be an insufficient key — a late-landing invalid flag changes ownership without a version bump — so `layerKey` and the dirty gate take an `ownersKey` fingerprint as well. See the revised decision in `design.md`.

## 3. Scrub overlay

- [x] 3.1 Extend the cursor's lower endpoint from `strips.delta.top + strips.delta.h` to `strips.sectors.top + strips.sectors.h`.
- [x] 3.2 Compute the hovered slice as `Math.min(SECTOR_COUNT - 1, Math.floor(pos * SECTOR_COUNT))` and fill a translucent white band over that slice's x-range spanning from `strips.speed.top` to the bottom of the ribbon.
- [x] 3.3 Tune the band alpha against the mock at full width so it reads as a highlight and never veils the traces or ribbon colors; decide there whether it needs a 1 px boundary edge.
- [x] 3.4 Draw the owner readout right-aligned on the `SECTORS` caption line — `S12 · Lap 2 · 3.482`, time in the critical tone with an `inv` suffix when the owner is invalid, and nothing at all when the slice has no owner.

## 4. Remove the DOM ribbon

- [x] 4.1 Delete the `owners.some(...)` JSX block, its per-slice `<span>`s, `onMouseEnter` / `onPointerUp` handlers and the `w-32` readout.
- [x] 4.2 Delete the `hoveredSector` state and the `hoveredOwner` derivation.
- [x] 4.3 Confirm `owners` is still computed on every render (not memoized on `version`) for the reason the existing comment gives, and is now consumed only by the ref from 2.1.

## 5. Verify

- [x] 5.1 `npm run lint -w web`, `npm run build -w web`, `npm run format:check`.
- [x] 5.2 Run the mock and dev servers per the `verify` skill, drive at least two laps with one cut so an invalid lap owns a slice.
- [x] 5.3 Confirm a slice boundary sits directly under the matching normalized position in the speed trace, at both ends of the axis and at mid-track.
- [x] 5.4 Confirm the cursor is unbroken from the top of the speed strip through the bottom of the ribbon, and that scrubbing over the ribbon itself behaves exactly like scrubbing over a trace.
- [x] 5.5 Confirm the band tracks the pointer, the readout names the slice and owner, and an invalid owner shows in the critical tone. **Not exercised:** the uncovered-slice case. Any complete mock lap covers all 24 slices, so no unowned slice exists once the panel has something to draw; the `if (owner)` guard is verified by reading, not by running.
- [x] 5.6 Confirm cursor, band, readout and track-map marker all clear together on pointer leave, and that touch drag scrubs identically.
- [x] 5.7 Resize the window across the `lg:` breakpoint and confirm the ribbon stays flush with the traces at both ends and keeps its thickness.
- [x] 5.8 Confirm the ribbon's colors still ignore which lap chip is hovered.

## 6. Invalid ownership keeps its lap identity

- [x] 6.1 Fill every owned slice with `lapColor(owner.lap)` regardless of validity, and mark an invalid owner with a subdued fill (`INVALID_SLICE_ALPHA`) plus a critical-tone bar along the slice's bottom edge (`INVALID_SLICE_BAR`), so ownership stays the primary signal and two different cut laps remain distinguishable.
- [x] 6.2 Confirm `ownersKey` already fingerprints the invalid flag, so the cached trace layer still rebuilds when a late-landing invalid flag changes a slice's marking rather than its owner.
- [x] 6.3 Tune `INVALID_SLICE_ALPHA` and `INVALID_SLICE_BAR` against the mock at full width and at the `lg:` breakpoint: the bar must read at 12 px ribbon height without swallowing the slice, and the subdued fill must stay clearly separable from both a valid owner and the unowned tone.
- [x] 6.4 Re-run `npm run lint -w web`, `npm run build -w web`, `npm run format:check`, and re-check that the scrub readout's `inv` suffix and critical-tone time are unchanged.

## 7. Sync

- [ ] 7.1 Run `/opsx:sync` to fold the `lap-analysis` and `mini-sector-timing` deltas into `openspec/specs/`, then archive the change.
