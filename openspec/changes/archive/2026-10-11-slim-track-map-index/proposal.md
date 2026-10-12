## Why

`CLAUDE.md` describes `web/src/components/TrackMap/index.tsx` (566 lines) as wiring: "it owns the one rAF loop and
its one dirty-gate expression, and every other job is a sibling module". Three jobs still live there:

- **The lap legend.** `syncLegend` (`index.tsx:260-281`) plus its JSX (`:496-530`). It is the only part of the map
  that joins in `lapsRef`.
- **The overlay controls.** The pedal key and the Follow car button JSX (`:470-495`, `:531-562`).
- **The dirty gate, written twice.** 15 `last*` mirrors are declared (`:289-305`), compared (`:335-354`) and
  reassigned one by one (`:356-372`). A term that is added to the comparison but not reassigned makes the map
  repaint every frame, and no check catches it.

## What Changes

- Move the legend's entry building and change key out of `index.tsx` into `TrackMap/legend.ts`, and its markup into
  `TrackMap/LapLegend.tsx`. `index.tsx` keeps the `legend` state and the call from `draw()`, because the rAF loop is
  what decides when the legend syncs.
- Move the pedal swatches into `TrackMap/PedalKey.tsx` and the Follow car / Exit follow button, including its
  visibility rule, into `TrackMap/FollowButton.tsx`.
- Rewrite the dirty gate as a single tuple of compared inputs, checked against the previous tuple. The gate stays
  one expression in `index.tsx`, and a new repaint input is still one more term.

The change has no effect on runtime behaviour: the same pixels, legend contents, button states, titles and repaint
cadence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `render-efficiency` (dirty-gated repaints), `track-map-follow-cam` (the Follow button and its dwell),
`lap-line-comparison` (the lap legend) and `lap-history` (pit tags in the legend) describe behaviour this change
keeps as it is. No requirement names a TrackMap file. **This change ships no spec deltas**, like the archived
`2026-09-27-split-track-map`.

## Out of Scope

- Moving `drawLaps` or the fixed-fit / fallback projection choice out of `index.tsx`. They are the body of the loop
  that `CLAUDE.md` assigns to `index.tsx`, and moving them would mean passing another dozen refs and functions.
- The factory wiring (`index.tsx:110-212`). It is the file's job.
- `useLapHistory` (discussed separately; deferred to the next feature that touches it).

## Impact

- **Code:** `web/src/components/TrackMap/index.tsx` shrinks to about 380 lines. New siblings: `legend.ts`,
  `LapLegend.tsx`, `PedalKey.tsx`, `FollowButton.tsx`. Nothing outside the folder changes.
- **Docs:** none. `CLAUDE.md`'s "TrackMap's layout" paragraph stays accurate.
- **Runtime cost:** no added renders or repaints. The gate allocates one short array per animation frame.
- **Verification:** the type checker proves the pieces fit, but the gate needs a manual check that the map neither
  freezes nor repaints at rest.
