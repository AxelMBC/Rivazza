## Why

`web/src/components/TrackMap.tsx` is 2,437 lines, 45% of `web/src`. About 1,900 of them are one
`useEffect` (lines 455–2340) holding roughly 60 inner functions. They share about 50 closure
`let`s and meet in a 19-term dirty gate. That closure mixes several unrelated jobs:

- line sampling and lap bookkeeping
- restart detection
- offscreen layer caching
- sector, cut and heading drawing
- lap hit-testing
- the follow and overview-inset cameras
- wheel, touch and dwell gestures

The file has been touched by 20 commits, more than any other file in the app. Every recent map
feature (follow cam, sectors, overview inset) landed inside this closure. `.claude/rules/code-style.md`
already names it as the outstanding case of "a file spanning more than two capabilities gets split".

## What Changes

- Turn `TrackMap.tsx` into a folder, `web/src/components/TrackMap/`, following the code-style rule
  "a component gets its own folder when it grows helpers only it uses". `index.tsx` keeps the
  component, its refs, the **single** rAF loop, the **single** dirty gate and the JSX.
- Move the closure's jobs into modules in that folder, each taking an explicit state object
  instead of reaching into shared `let`s:
  - map-data fetching
  - follow-mode UI state and dwell
  - line sampling and lap bookkeeping
  - layer rendering
  - markers
  - hit-testing and hover readout
  - camera
  - gestures
  - palette and constants
- Move `web/src/lib/overviewInset.ts` into the folder. TrackMap is its only importer.
- Move the map-data probe's generic `async <T,>` arrow out of `.tsx`. The code-style rule forbids
  the `<T,>` hack.
- Source the legend's three pedal swatches (hard-coded `rgb(…)` strings in the JSX) from the same
  palette constants the canvas lerps between. This keeps the colours in one place and changes
  none of them.
- Update the path references in `CLAUDE.md` and the TrackMap note in `code-style.md`.

This change has no effect on runtime behaviour: the same pixels, cursor states, hover picks,
camera easing, gesture responses and repaint cadence. `App.tsx`'s `import { TrackMap } from
"./components/TrackMap"` resolves to the folder's `index.tsx` unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. No requirement in `openspec/specs/` names a TrackMap file path. `render-efficiency`
(dirty-gated rAF, layer caching), `track-map-viewport`, `track-map-zoom`, `track-map-follow-cam`,
`track-map-overview`, `track-sector-division`, `cut-markers`, `car-heading-marker`,
`lap-line-comparison`, `driving-line-gradient` and `touch-interaction` all describe behaviour this
change keeps as it is.

**This change ships no spec deltas.** `/opsx:verify` must therefore skip
`openspec validate --type change`, which fails with "must have at least one delta" when `specs/` is
empty. That failure is not a defect.

## Impact

- **Code:** `web/src/components/TrackMap.tsx` becomes `web/src/components/TrackMap/` (an
  `index.tsx` plus about nine modules). `web/src/lib/overviewInset.ts` moves into it. Nothing
  outside the folder changes except a possible import of the shared pedal colours. No hook in
  `web/src/hooks/`, no wire type and no bridge file is touched.
- **Wire contract:** none. `@rivazza/protocol` imports stay as they are (this branch is cut from
  `dev`, which already carries the shared contract).
- **Docs:** `CLAUDE.md` (the track-map projection paragraph and the `lib/overviewInset.ts`
  reference) and `.claude/rules/code-style.md` (the "outstanding case" note).
- **Git history:** `git log --follow` survives the rename for `index.tsx`. Blame for moved
  function bodies needs `git blame -C -C`.
- **Verification:** almost entirely manual. The type checker proves the modules still fit
  together, but not that the map still draws, picks, zooms and follows the same way.
