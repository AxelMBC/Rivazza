Each group ends with a **smoke check**: the web typecheck plus a quick look at the running app. It
runs before the next group starts, so any behaviour drift traces to one group's diff (design D8).
The full manual pass is §10.

Smoke check, used below:
- `npx tsc -b web --noEmit` passes.
- With `npm run mock -w bridge` and `npm run dev` running: the dot moves around Magione, the
  current-lap line draws in pedal colours, wheel zoom works, and the browser console has no errors.

## 0. Baseline (before touching code)

- [x] 0.1 With the mock and `npm run dev` running on the unmodified branch: record 10 s in the
      DevTools Performance panel with the mouse resting still over the map. Note the rAF
      callbacks that paint versus those that return at the gate, and the scripting time per
      frame. §10.3 compares against this. (Stopping the mock is not an idle test: `waiting`
      clears the session and unmounts the map.)
      *Done with a headless-Edge harness instead of DevTools. It wraps `requestAnimationFrame`
      and counts `clearRect` on the map canvas. Baseline with the cursor resting: 55.8 map
      paints/s, 0.225 ms per rAF callback (all three app loops, 180 rAF/s). While following:
      60 paints/s, 0.43 ms. Hover-dwell follow in and out, wheel zoom → inset, and inset
      rest-glide all pass, with no page errors.*

## 1. Folder move (pure rename)

- [x] 1.1 `git mv web/src/components/TrackMap.tsx web/src/components/TrackMap/index.tsx`. Fix its
      relative imports (`../hooks` → `../../hooks`, `../lib` → `../../lib`). `App.tsx` stays as it is
- [x] 1.2 `git mv web/src/lib/overviewInset.ts web/src/components/TrackMap/overviewInset.ts` and
      point the import at `./overviewInset`
- [x] 1.3 `CLAUDE.md`: update the track-map projection paragraph's path and the
      `web/src/lib/overviewInset.ts` reference
- [x] 1.4 Smoke check. *Vite's dev server caches the old `./components/TrackMap` → `TrackMap.tsx`
      resolution, so a file move needs the dev server restarted (on Windows, kill it by port:
      TaskStop leaves the node children running).*

## 2. Constants and palette

- [x] 2.1 `constants.ts`: sizing, timing, zoom, follow, inset-dwell and sampling constants, each
      with its tuning comment unchanged
- [x] 2.2 `palette.ts`: canvas colour constants, `COAST`/`THROTTLE`/`BRAKE`, `lerpColor`,
      `COLOR_QUANT`, `bucketKey` and `bucketColor`. *The block's stroke widths, tick lengths and label
      fonts came along too, because they share comments with their colours. `INSET_CAR_RADIUS` went
      to `constants.ts`. A new `rgb()` formatter is shared by the lerp and the legend.*
- [x] 2.3 Legend swatches in the JSX read `THROTTLE`/`COAST`/`BRAKE` from `palette.ts` instead of
      the hard-coded `rgb(…)` strings. Same values
- [x] 2.4 Smoke check

## 3. React-side hooks

- [x] 3.1 `useTrackMapData.ts`: the meta/edges probe effect, including the `IS_DEMO` →
      `DEMO_MAP_URL` branch, returning `{ mapData, mapProbed }`. The generic `probe` leaves `.tsx`,
      removing the `<T,>` hack. `resetLines()` still runs on session change, as it does today
- [x] 3.2 `useFollowControl.ts`: `followRef`, `followUi`, `dwelling`, the dwell timer,
      `setFollow`, `cancelDwell`, `retargetFollow`, `startDwell`, `leaveDwell`,
      `onFollowActivate` and the unmount cleanup. `resetLines()` stays in `index.tsx` (design D5)
      *Refinement: the hook returns `followUi` and `dwelling` (render state) plus one `follow`
      object created once with `useState(() => …)`. Returning the refs and functions loose raised
      two new `exhaustive-deps` warnings (the original file had 0), because oxlint only treats
      refs and setters as stable when they come straight from React. `follow` never changes
      identity, so the render effect lists `[…, follow, resetLines]` and still re-runs only on
      `mapData`. `resetLines` is a `useCallback([follow])`, and the session reset is
      `useEffect(() => resetLines(), [session, resetLines])`. `followWindowRef` and
      `followLimitsRef` moved into the hook along with `resetFollow()`.*
- [x] 3.3 Smoke check, plus: the Follow car button engages after a 1 s hover and the Exit follow
      button releases the same way

## 4. Geometry and line recorder

- [x] 4.1 `trackGeometry.ts`: `buildTrackGeometry(mapData)` covering the edge bounds,
      `edgeView`/`edgeCentre`, `traceInto`, the fill and per-sector edge `Path2D`s, the sector
      label and tick anchors, and `sectorVertexRuns`
- [x] 4.2 `lineRecorder.ts`: `createLineRecorder(…)` with `ingest(frame, cutList)`. That covers
      restart detection (signature moved as it is), lap completion into `previousLapsRef`,
      sample appends at `SAMPLE_SPACING`, the `TELEPORT_DIST` break, the `MAX_SAMPLES`/`MAX_LAPS`
      caps, cut consumption and bounds. It is called from the same point in `draw()`, inside the
      gated branch (design D6)
      *Refinement: the recorder is a component-level stable object (`useState(createLineRecorder)`),
      not an effect-level factory. Line state has to outlive the render effect, which re-runs when
      map data arrives mid-session, and a recreated lap counter would miss a lap completion. It
      exposes ref-shaped fields (`currentRef`, `previousLapsRef`, `currentCutRef`, `boundsRef`,
      `anchorRef`) so readers are unchanged, plus `lapsVersion()`, `reset()` (called by
      `resetLines`) and `ingest(frame, cutList, onRestart)`. The lap counter, lap clock and cut
      cursor became private `let`s.*
- [x] 4.3 Smoke check, plus: at the mock's 90 s lap tick the finished lap stays on the map as a
      reference line and appears in the legend

## 5. Layers, markers, hit test

- [x] 5.1 `layers.ts`: the four offscreen canvases, `sizeLayer`, `blitLayer`, `affineOf`,
      `strokeWorldPath`, `buildLapPath`, `renderTrackLayer`, `renderLapsLayer`,
      `renderCurrentLayer`, `drawCurrentTail`, their cache keys and `lapsVersion`. Put the inset
      layer here or next to `overviewInset.ts`, whichever reads better, and note the choice (design D7)
      *Choice: the inset layer and `drawInset` are in `layers.ts`, which owns the offscreen canvas.
      `overviewInset.ts` stays pure geometry with no canvas. `zoomed`, `affineOf`,
      `strokeWorldPath`, `buildLapPath` and the `Project`/`Affine` types went to a new
      `projection.ts`, because markers, layers and hit test all need them. The per-frame `inset`
      is `insetRef`, a ref-shaped object passed by reference. That is the `frameState` of design D3,
      in the same shape as every other shared value. `drawLaps` (the lap-scene composition)
      stays in `index.tsx`. An `inset` → `insetRef.current` rewrite corrupted the JSX class
      `inset-x-0`, which `tsc` cannot see. It was caught and fixed, and a check that every string
      literal in the original file still appears in the folder now passes.*
- [x] 5.2 `markers.ts`: sector ticks and labels, `syncSectorTables`, cut crosses and halos, the
      heading tracker, `drawDot`, the scrub ring, marker and sector
- [x] 5.3 `hitTest.ts`: `hitTestLaps`, `pedalSeg`, `drawHoverReadout` and `setCursor` with
      `lastCursor`
- [x] 5.4 Smoke check, plus: hovering a stored lap line turns the cursor to `pointer` and shows the
      readout

## 6. Camera

- [x] 6.1 `camera.ts`: fallback-view easing toward the driven bounds, `followCamera` (trail
      buffer, `followPos`, `camOffPx`, window limits), `navCamera` and `dotWorld`. Its animating
      flags are exposed for the gate as getters, and the gate stays one expression in `index.tsx`
      (design D4)
      *The fallback auto-fit became two pure helpers in `camera.ts`: `fallbackTarget` (first-lap
      anchor versus driven bounds) and `easeView` (asymptotic ease plus snap, returning
      `{ view, easing }`). The base projections moved to `projection.ts` as `metaProjection` and
      `viewProjection`. The edge-fit and fallback branches used the same view formula, so it is
      written once. The map.ini and edges branches of `draw()` were identical apart from the
      base projection and the key prefix, so they merged into one fixed-fit path that keeps the
      `m`/`e` prefixes. `easing` stays a gate-local `let` in `index.tsx`. The camera is created
      before the drawing factories, so the deferred `dotWorld` wrapper from §5 is gone.*
- [x] 6.2 Smoke check, plus: follow mode glides in and tracks the car, and exit glides back to the
      fit view

## 7. Gestures

- [x] 7.1 `gestures.ts`: `attachGestures(canvas, …)` covering mouse move/leave, click, wheel
      zoom, the inset dwell timer and anchor, `navigateTo`, the touch tap, pan and pinch state, and
      `detachFollow`. It returns one detach function that the effect cleanup calls with
      `cancelAnimationFrame`
- [x] 7.2 Per-frame shared values (`inset`, the current projection) are read through the shared
      `frameState` object, never destructured at attach time (design D3, stale-capture risk). Grep
      the new modules for top-level destructuring of shared objects
      *Checked. No factory reads a `.current` value at creation. The one factory-level hit
      (`camera.ts` `easeView`) is a plain function that runs on each call. The effect-level reads
      in `index.tsx` are the gate's initial mirrors, as in the original.*
- [x] 7.3 Smoke check, plus: from the second wheel notch the overview inset appears, and a ~250 ms
      rest on it glides the view there

## 8. Wiring cleanup

- [x] 8.1 `index.tsx` holds only props, refs, `resetLines`, factory wiring, `draw()` with its
      single dirty gate, and the JSX. `git grep -c requestAnimationFrame -- web/src/components/TrackMap`
      shows only `index.tsx` (one initial call plus one recursive call)
- [x] 8.2 No section-banner comments, no `function` declarations, and no comment left narrating a
      move. Load-bearing comments travelled with their code
- [x] 8.3 `npm run format` (Prettier owns import order), then `npm run lint -w web`
      *`index.tsx` is 568 lines, down from 2,437. The legend block in `draw()` became a named
      `syncLegend`. `drawLaps` and `showsInset` stay as the lap-scene composition. The import
      helper wrote all-type imports as `import { type X }`, and those were normalised to
      `import type { X }`. Lint and `format:check` are clean.*

## 9. Docs

- [x] 9.1 `.claude/rules/code-style.md`: remove TrackMap as "the outstanding case" in the
      more-than-two-capabilities bullet
- [x] 9.2 `CLAUDE.md`: in the track-map projection paragraph, point readers at the folder
      (`web/src/components/TrackMap/`) and name where projection and camera now live, so the
      "flip the X term in `project`" advice still points somewhere real
      *Also points the restart-signature note at `TrackMap/lineRecorder.ts`, and adds a short
      "TrackMap's layout" paragraph on the seam: component-level stable objects versus
      effect-level factories, refs as the only channel, and new repaint inputs going into the gate.*

## 10. Verification

- [x] 10.1 Run `/opsx:verify`: bridge and web typecheck, lint and formatting. **Skip**
      `openspec validate --type change`, because this change has no spec deltas
      *Passed 2026-09-27T19:06Z. All four checks green, spec validation skipped (no deltas), receipt in `.verified.json`.*
- [x] 10.2 With the mock and `npm run dev` running: the dot laps Magione without the map
      re-fitting (`map.ini` bounds fix the viewport), and the current lap draws in the
      coast/throttle/brake gradient
      *Mock: fit framing identical across every group's run, pedal gradient drawn.*
- [x] 10.3 Repeat the §0.1 recording under the same conditions. The paint/early-return split
      and the scripting time per frame match the baseline within noise. A higher paint count means
      a gate term or the ingestion moved out of place (design D4, D6)
      *Cursor resting: 55.5 paints/s and 0.238 ms per rAF, against the baseline's 55.8 and 0.225. Following: 59 and 0.44, against 60 and 0.43. Across all runs the range was 55.4–57.4 paints/s and 0.215–0.246 ms, so it is within noise.*
- [x] 10.4 After the 90 s lap tick: the lap is kept as a reference line with its legend entry, and
      hovering it gives a `pointer` cursor and the hover readout. The session-lap-list row hover
      highlights the same line (the shared `hoveredLapRef`)
      *Lap stored with its legend entry, and hovering it gives `pointer` plus the readout. A "Lap 2" row hover in the session lap list redraws Lap 2 on top with the emphasis stroke.*
- [x] 10.5 With cut detection on: a red × appears on the in-progress lap at the cut (~every 40 s)
      and disappears from the ambient view once that lap completes. Hovering the stored lap
      reveals it again
      *The in-progress lap shows its ×. A stored lap's × shows only while that lap is focused (line hover, or the analysis selection).*
- [x] 10.6 Sector ticks and labels are drawn, and hovering a sector in the analysis panel
      highlights its edges on the map
      *Ticks and labels show ownership (`S4 · L13 INV`). An analysis-panel scrub over S3 brightens S3's edges and ticks, bolds its label and rings the line.*
- [ ] 10.7 Wheel zoom stays anchored at the cursor, and zooming out past `ZOOM_SNAP_LEVEL` snaps
      back to the fit view. From the second notch the overview inset shows, and a 250 ms cursor
      rest glides the view to that point
      *Partly verified, so left open. Three wheel notches bring up the inset, a rest on it glides there (same framing as the baseline), and wheeling fully out returns to exactly 1× fit. Not verified: the `ZOOM_SNAP_LEVEL` snap, which is the pinch-end rule (a pinch released between 1× and 1.02× snaps to fit). A 1% zoom difference can't be told apart in a screenshot. To check it by hand: pinch out until the view is just above fit, release, and the framing should jump to exactly the fit view.*
- [x] 10.8 Follow car: 1 s dwell engages it, the camera glides in and tracks with the heading
      tick, the wheel changes the follow window within its limits, and 1 s dwell on Exit follow
      glides back
      *The 1 s dwell engages follow, the car is pinned at the canvas centre with its heading tick, and the Exit dwell glides back. Wheel-in while following tightens the framing with the car still centred. Wheeling out past the widest framing hands over to the exit glide and ends at "Follow car".*
- [x] 10.9 Restart the mock (session reset): after re-handshake the lines, laps, zoom and follow
      state are all cleared
      *Both paths. Restarting the mock (waiting, then a new session) comes back at fit with no laps or zoom. The demo replay's loop wraps `lapCount` 5 → 0 within one session, which hits `lineRecorder.ingest`'s restart branch: the 5 stored laps clear and the sector owners reset.*
- [x] 10.10 `npm run dev:demo`: the map outline loads from the demo file, the recorded session
      replays, and click mode activates follow on click
      *Demo build at 10× replay speed: the Imola outline loads from the demo file, and click mode engages and releases follow on click.*
- [x] 10.11 Touch (DevTools device emulation): tap toggles follow, one-finger pan and pinch zoom
      work, and a tap on the inset navigates there
      *CDP touch events: tap toggles follow both ways, a pinch zooms about 5× with the inset, a one-finger pan moves the view, and a tap on the inset navigates there.*
- [x] 10.12 Fallback auto-fit (no map data): run the bridge with `AC_PATH` pointing at an empty
      folder and the mock running. The map shows "No map file — drawing your driving line", the
      first lap is framed around the starting point, and the view eases without stuttering.
      Magione has a `map.ini`, so the mock alone never reaches this path or the edges-only one
      (both were restructured in §6)
      *`AC_PATH` set to an empty folder: the bridge logs no map data, the notice shows, the first lap is framed zoomed out at the start, and there is no inset (fixed-fit only). The two map probes' 404s appear as console resource errors, the same probe code as before.*
- [x] 10.13 The browser console shows no errors across all of the above
      *No page errors in any run. The only console errors are the fallback run's expected 404 probe responses.*
