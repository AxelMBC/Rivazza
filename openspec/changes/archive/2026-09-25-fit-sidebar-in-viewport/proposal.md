## Why

`racer-dashboard` already requires the whole dashboard to fit "in a single non-scrolling viewport on
a typical 16:9 desktop display", and the sidebar no longer does. Measured in the demo build, its
content is 847 px tall. A 1920×1080 browser window gives it 794 px, and a 1920 laptop at 125%
scaling gives it 615 px, so the bottom of the G-force card sits below the fold and needs a scroll.
While driving you can't scroll: the UI is hover-only, and clicking would take focus from the game.

Measured budget (px): cluster 239 · timing tiles 164 · Lap tile 54 · pedal trace 170 · G-force /
steering row 184 · gaps 36. The G-force / steering row is the real waste. The steering card is
66 px tall, which leaves a ~214×118 px empty area under it, next to the G meter.

## What Changes

- **The Lap counter tile is removed.** The lap number moves into the current-lap tile's label
  ("Lap 3" instead of "Current lap"), so no information is lost.
- **The session lap-list flyout** opens by hovering the Last-lap or Best-lap tile instead of the
  removed Lap tile. It has the same contents, colors, scrolling and tap-to-toggle behavior on touch.
  Every recorded lap time stays reachable by hover.
- **The steering indicator moves into the instrument cluster**, on the ABS / TC / PIT status-light
  row. Its standalone card is removed.
- **The pedal trace is removed. The G-force meter and two live pedal bars share one card instead.**
  In the sidebar the 12-second time series got ~16 px per second in a tall box and read as a
  barcode. It also repeated what the dashboard already shows better. The live driving line colors
  throttle / coast / brake at every track position, and lap analysis plots throttle and brake per
  position for complete laps. Two thin vertical bars (throttle, brake) give the current pedal
  position at a glance, and the G-force meter gets the rest of the card. Clutch is no longer shown.
  `useInputHistory` shrinks to the ~2 s the G-force path draws.
- **The G-force / pedal-bar card becomes the sidebar's only elastic element**: it fills whatever
  height the fixed cards leave. The sidebar then fits without scrolling on 1080p desktops and on
  common laptop viewports (down to ~1366×650), not only at one tuned height.
- The `racer-dashboard` "single non-scrolling viewport" scenario gets a concrete, checkable size
  range in place of "typical 16:9 desktop display".

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `racer-dashboard`: the layout requirement names the new arrangement (steering in the cluster,
  G-meter + pedal bars in one elastic card) and a concrete no-scroll viewport range. "Pedal trace
  history" is removed and "Live pedal bars" added.
  The focus-safe reveal scenario names the Last/Best tiles as the lap-list trigger, not the Lap
  tile.
- `lap-history`: the hover-revealed lap list is triggered from the Last-lap / Best-lap tiles. The
  current-lap tile carries the lap number that the removed Lap tile used to show.
- `render-efficiency`: the repaint requirement no longer lists a pedal trace or time-scrolled
  surfaces, and the input-history buffer covers only the G-force path (~2 s instead of 12 s).
- `cut-markers`: "the Lap tile's session-lap list" becomes "the session-lap list". The behavior
  does not change; only the trigger it names is gone.

## Impact

- **Web only.** Affected files: `web/src/App.tsx` (sidebar grid/flex),
  `web/src/components/LapTimes.tsx` (Lap tile removed, flyout re-anchored, lap number in the
  label), `InstrumentCluster.tsx` (hosts `SteeringBar`), `PedalTrace.tsx` (deleted), new `PedalBars.tsx`, `GForceMeter.tsx`, `useInputHistory.ts`
  (fluid sizing inside one card).
- No bridge change and no wire-type change. Both `types.ts` files are untouched.
- `useInputHistory` only shrinks (fewer fields, a 2 s buffer). `useLapHistory` and `hoveredLapRef`
  are consumed exactly as today.
- The canvases keep their rAF dirty-gates. They already repaint on a client size or DPR change, so
  becoming elastic adds no per-frame cost.
- Below the `lg` breakpoint (stacked mobile layout) the sidebar keeps scrolling as it does today.
  Only the desktop grid is in scope.
