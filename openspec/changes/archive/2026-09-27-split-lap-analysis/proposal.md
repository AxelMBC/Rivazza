## Why

`web/src/components/LapAnalysis.tsx` is 749 lines, now the largest file in `web/src` after the
TrackMap split. About 450 of them are one `useEffect` (lines 161–607) that mixes four jobs:

- the offscreen trace layer (ribbon, grid, speed, pedal and delta traces, captions)
- the scrub overlay (band, cursor line, sector readout, cross-lap tooltip)
- scrub input (mouse and touch), which also publishes `scrubRef` for the track map
- the dirty-gated rAF loop

The JSX beneath it (header, lap chips, collapsed bar) is another 130 lines. It is the same shape
TrackMap had, only smaller. Splitting it now, while it is 749 lines and not 2,400, costs one
change instead of a rescue.

## What Changes

- Turn `LapAnalysis.tsx` into a folder, `web/src/components/LapAnalysis/`, following the
  code-style rule "a component gets its own folder when it grows helpers only it uses".
  `index.tsx` keeps the component, its state and refs, the **single** rAF loop, the **single**
  dirty gate and the panel JSX.
- Move the effect's jobs into sibling modules, each an effect-level `create…`/`attach…` factory
  given the canvas contexts and refs it reads, the pattern `TrackMap/` established:
  - layout constants, palette and the strip geometry (`layoutStrips`, `sliceAt`, `plotX`)
  - the trace layer
  - the scrub overlay
  - scrub input
- Pull the lap-chip row into its own `LapChips.tsx` child component.
- Update the file-split bullet in `.claude/rules/code-style.md` to cite both folders.

No behaviour changes. `web/src/lib/lapAnalysis.ts` (the pure sector and interpolation math) stays
where it is: `TrackMap` and `useLapRecordings` import it too.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement in `openspec/specs/` names a LapAnalysis file path. `lap-analysis`,
`render-efficiency` (dirty-gated rAF, layer caching), `touch-interaction` and `demo-replay`
describe behaviour this change keeps as it is.

**This change ships no spec deltas.** `/opsx:verify` must skip `openspec validate --type change`,
which fails with "must have at least one delta" when `specs/` is empty. That is not a defect.

## Impact

- **Code:** `web/src/components/LapAnalysis.tsx` becomes `web/src/components/LapAnalysis/`
  (`index.tsx` plus five modules). `App.tsx`'s import path `./components/LapAnalysis` resolves to
  the folder's `index.tsx` unchanged. No hook, no `lib/` file, no wire type and no bridge file is
  touched.
- **Docs:** `.claude/rules/code-style.md` only. `CLAUDE.md` and the verify skill don't name the
  file.
- **Git history:** `git log --follow` survives the rename for `index.tsx`; moved bodies need
  `git blame -C -C`.
- **Verification:** mostly manual. The type checker proves the pieces fit, not that the traces
  draw, scrub and echo on the map the same way.
