Each group ends with a **smoke check**, run before the next group starts, so any behaviour drift
traces to one group's diff (design D7). The full manual pass is §8.

Smoke check, used below:
- `npx tsc -b web --noEmit` and `npm run lint -w web` pass.
- With `npm run mock -w bridge` and `npm run dev` running, after the first 90 s lap tick: hovering
  the "Lap analysis" bar opens the panel, the traces and ribbon draw, scrubbing shows the tooltip
  and the ring on the map, and the browser console has no errors.

## 0. Baseline (before touching code)

- [x] 0.1 With the mock and `npm run dev` running on the unmodified branch, after at least two lap
      ticks: open the panel and rest the cursor still on its canvas. Record the analysis canvas's
      paints per second and the scripting time per rAF callback (the `split-track-map` harness
      approach: wrap `requestAnimationFrame`, count `clearRect` on this canvas). Also capture a
      screenshot of the panel mid-scrub at a fixed x. §8.3 and §8.4 compare against these
      *Headless-Edge harness (`analysis.mjs`, wraps rAF and counts `clearRect` on the analysis canvas). Mock, 2 laps, both invalid, so no reference. Panel open with the cursor resting on the canvas: 0 analysis paints/s, 0.239 ms per rAF (180 rAF/s across all loops). Panel open, no scrub: 0 paints/s, 0.223 ms. Mid-scrub screenshots of the panel and map saved.*

## 1. Folder move (pure rename)

- [x] 1.1 `git mv web/src/components/LapAnalysis.tsx web/src/components/LapAnalysis/index.tsx` and
      fix its relative imports (`../hooks` → `../../hooks`, `../lib` → `../../lib`). `App.tsx`
      stays as it is
- [x] 1.2 Restart the dev server (Vite caches the old file resolution; on Windows kill it by port)
- [x] 1.3 Smoke check
      *Load check (`smoke.mjs`): map and analysis canvas render with no console errors. Typecheck and lint clean. The full hover/scrub pass needs two 90 s laps, so it runs once in §8 rather than per group.*

## 2. Constants

- [x] 2.1 `constants.ts`: `PAD_*`, `STRIP_GAP`, `RIBBON_H`, `SLICE_GAP`, the colour constants,
      `INVALID_SLICE_*`, `SCRUB_BAND`, `MIN_DELTA_RANGE_MS`, `Strip`, `layoutStrips`, `sliceAt` and
      `ownersKey`, each with its comment unchanged
- [x] 2.2 Add `plotX(pos, width)` there, replacing the effect-local arrow (design D2)
- [x] 2.3 Smoke check
      *Typecheck, lint and load check clean.*

## 3. Lap chips

- [x] 3.1 `LapChips.tsx`: the chip row, with props `reviewableLaps`, `laps`, `selected`,
      `reference` and `onSelect` (design D6). Hover-select and touch-select handlers move
      verbatim, and so do the class strings. Diff the JSX string literals before and after
      *A literal check (every quoted and template string of the original file is present in the folder) reports none missing.*
- [x] 3.2 Smoke check, plus hovering a chip selects that lap and the selection sticks after the
      mouse leaves the chip
      *Load check clean. Chip hover-select is covered by §8.6.*

## 4. Scrub overlay

- [x] 4.1 `scrubOverlay.ts`: `drawScrubOverlay(ctx, pos, sel, ref, owners, width, height)`, drawing
      the band, cursor line, sector readout and cross-lap tooltip on the visible context only
      (design D4)
- [x] 4.2 Smoke check
      *Typecheck, lint, load and literal checks clean.*

## 5. Trace layer

- [x] 5.1 `traceLayer.ts`: `createTraceLayer(canvas)` owns the offscreen canvas and returns
      `{ layer, render(sel, ref, owners, width, height, dpr) }`, or `null` when `getContext` fails.
      `tracePolyline` moves in as a private helper
- [x] 5.2 `index.tsx` keeps the `layerKey` check and calls `render` only when the key changes
- [x] 5.3 Smoke check
      *Typecheck, lint, load and literal checks clean.*

## 6. Scrub input

- [x] 6.1 Add a component-level `scrubPosRef = useRef<number | null>(null)` in place of the
      `mousePos` closure `let` (design D3). The gate and `drawScrubOverlay` read it
- [x] 6.2 `scrubInput.ts`: `attachScrub(canvas, { scrubPosRef, selectedRef, scrubRef })` registers
      the mouse and touch listeners (same `passive: false` options) and returns a detach function
- [x] 6.3 Effect cleanup in `index.tsx`, in this order: `cancelAnimationFrame`, `detachScrub()`,
      then `scrubRef.current = null`
- [x] 6.4 Confirm the gate still has all nine terms and oxlint reports no new exhaustive-deps
      warning
      *All nine terms present (`scrubPosRef.current` replaces `mousePos`). Effect deps are still `[scrubRef]`, with no exhaustive-deps warning.*
- [x] 6.5 Smoke check
      *Typecheck, lint, load and literal checks clean.*

## 7. Docs

- [x] 7.1 `.claude/rules/code-style.md`: the file-split bullet cites
      `web/src/components/LapAnalysis/` alongside `TrackMap/`
- [x] 7.2 `npm run format`

## 8. Verification

- [x] 8.1 Run `/opsx:verify`: bridge and web typecheck, lint and formatting. **Skip**
      `openspec validate --type change`, because this change has no spec deltas
      *Passed 2026-09-27T19:35Z. All four checks green, spec validation skipped (no deltas), receipt in `.verified.json`.*
- [x] 8.2 `index.tsx` is under ~300 lines and every sibling module owns one job (design Goals)
      *`index.tsx` is 308 lines, a few over the ~300 target. The rest is wiring plus the panel JSX (header and collapsed bar), which design D6 keeps in index. Modules: `constants.ts` 57, `LapChips.tsx` 65, `scrubInput.ts` 60, `scrubOverlay.ts` 138, `traceLayer.ts` 227.*
- [x] 8.3 Repeat the §0.1 idle recording. Paints per second and scripting time per rAF match the
      baseline within noise. More paints means a gate term moved or `scrubPosRef` changes every
      frame
      *Analysis canvas at rest with the panel open: 0 paints/s, the same as the baseline, both scrub-resting and no-scrub. Per-rAF scripting fell from 0.239 to 0.157 ms (0.223 to 0.109 with no scrub). That total covers all three loops, and the run happened later in the mock session with different map state, so it is not a like-for-like drop. No increase.*
- [x] 8.4 Scrub at the §0.1 x: the band, cursor line, sector readout (`S<n> · Lap <n> · <time>`)
      and tooltip rows (selected lap, reference lap, Δ) match the baseline screenshot, and the
      track map draws the scrub ring in the selected lap's colour with that sector highlighted
      *Same composition as the baseline screenshot: scrub band, cursor line, `S4 · Lap 7 · 3.750 inv` readout, `Lap 8 · 81 km/h · G3 · BRK 52%` tooltip. The map draws the ring in Lap 8's colour with S4 highlighted. The Δ row needs a valid reference, which the mock never has (every lap is cut); the demo run showed the traces and ribbon with a reference.*
- [x] 8.5 Leaving the canvas clears the tooltip and the map ring. Closing the panel clears the
      map's brake ticks for the analysed lap (`analysisLapRef` back to null)
      *Moving off the canvas (still inside the panel) removes the tooltip and the map ring. Closing the panel returns the map to the live pedal-coloured line with no analysed-lap emphasis or its × markers.*
- [ ] 8.6 With the default selection the panel follows the latest lap as new laps complete. A
      hovered chip stays selected. After a mock restart, the selection falls back to "Complete a
      lap to unlock analysis"
      *Partly verified, so left open. The panel followed the latest lap (Lap 8) and a hovered chip (Lap 7) stayed selected after the mouse moved away. Not run: the mock restart. The eviction effect moved unchanged within `index.tsx`. To check it: with the panel on a lap, restart the mock, and the panel should show "Complete a lap to unlock analysis".*
- [x] 8.7 An invalid lap (the mock's periodic cut) shows `inv` on its chip and header, its ribbon
      slices are dimmed with the red bar, and selecting it reveals its cut markers on the map
      *Mock laps are all invalid: chips and header show `INV`, ribbon slices are dimmed with the red bar, and the selected lap's × shows on its map line.*
- [x] 8.8 Touch (CDP touch events): a finger drag on the canvas scrubs without scrolling the page,
      and lifting clears it. A chip tap selects the lap
      *Demo build with CDP touch: a finger drag scrubs (tooltip `Lap 2 · 174 km/h · G4 · THR 100%`) without scrolling the page, lifting clears it, and a chip tap selects Lap 1 (`LAP 1 VS LAP 2 (REF)`).*
- [x] 8.9 `npm run dev:demo`: click mode toggles the panel open and closed from the bar, and the
      replayed laps are reviewable
      *Demo build at 10×: a click on the bar opens the panel (opacity 1) and a second click closes it (0). Two replayed laps are reviewable, with theoretical and session best shown.*
- [x] 8.10 The browser console shows no errors across all of the above
      *No page or console errors in any run (mock baseline, mock after, demo).*