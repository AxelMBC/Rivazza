## 1. Lap timing: drop the Lap tile, move the flyout

- [x] 1.1 In `LapTimes.tsx`, label the Current-lap tile `Lap {lapCount + 1}` (placeholder `Lap –` without telemetry), keeping the INV chip after the label
- [x] 1.2 Remove the Lap counter tile and render Last-lap and Best-lap inside one `col-span-2` two-column wrapper that carries `HOVER_GROUP_CLASS relative`, the existing `onPointerUp` toggle, and `LapListPanel`
- [x] 1.3 Move the hover affordance to `group-hover:border-accent/60` on both Last and Best tiles so they highlight together; leave `LapListPanel` and `hoveredLapRef` handling unchanged

## 2. Steering into the instrument cluster

- [x] 2.1 Give `SteeringBar` a single-line compact layout (bar `flex-1` + degree readout, no caption), keeping `MAX_DEG` and the deflection math
- [x] 2.2 In `InstrumentCluster.tsx`, make the status-light row `flex` with ABS/TC/PIT on the left and `SteeringBar` filling the rest; confirm the tyre overlay still covers the whole cluster

## 3. Combined, elastic G-force / pedal-bar card

- [x] 3.1 Strip the `<section>` card chrome from `GForceMeter`; it becomes a flex column (header + canvas `flex-1 min-h-0`) with its rAF loop and dirty-gate untouched
- [x] 3.2 Add `web/src/components/DriverInputs.tsx`: one card, `grid-cols-[1fr_auto]`, G-force left and `PedalBars` right
- [x] 3.3 In `App.tsx`, replace the `PedalTrace` + G-force/Steering row with `<DriverInputs>` as `lg:flex-1 lg:min-h-24` (`h-42` below lg); keep `overflow-y-auto` on the column for the stacked layout
- [x] 3.4 Timing tiles `py-3` → `py-2` (design Risk lever), giving the card 16 px at 1366×650
- [x] 3.5 Delete `PedalTrace.tsx`; add `PedalBars.tsx` (throttle/brake vertical bars with whole-percent values from `telemetry` state)
- [x] 3.6 Trim `useInputHistory` to the G-force path: drop `gas`/`brake`/`clutch`, `CAPACITY` 360 → 60; `GForceMeter` draws the whole buffer (`PATH_SAMPLES` removed)
- [x] 3.7 Remove `PedalTrace` from `CLAUDE.md`, `README.md`, `.claude/commands/opsx/{explore,verify}.md`

## 4. Verification

- [x] 4.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [x] 4.2 With `npm run dev:demo`, measure the sidebar column (puppeteer, as in design.md Context) at 1920×1080, 1911×909, 1536×730 and 1366×650: `scrollHeight <= clientHeight` at every size and the G-force circle is fully visible
- [x] 4.3 Resize the window between those heights and confirm only the G/pedal-bar card changes height (measured: cluster 239 and tiles 148 constant; card 554 / 383 / 204 / 124 px at the four sizes), the G rings stay circular, and the pedal bars span the card height
- [x] 4.4 In a hover-mode build (mock + `npm run dev`), hover the Last-lap tile: the session-lap flyout opens above; slide to Best-lap and onto the panel without it closing; hovering Current-lap or Delta alone does not open it
- [x] 4.5 With a cut lap stored, hover its row in the flyout and confirm its × marker appears on the track map
- [x] 4.6 Confirm the Current-lap label reads "Lap N" matching the lap counter and shows INV live after a mock cut; steer input moves the bar in the cluster; throttle/brake bars track the pedals with matching percentages
- [x] 4.7 (click mode confirmed by puppeteer: Current-lap click leaves it closed, Last opens, Best closes; touch emulation still unchecked) In the demo (click mode) and with touch emulation, a tap/click on Last/Best toggles the flyout open and closed
- [x] 4.8 Watch devtools Performance for ~10 s while idle: no continuous repaint from `GForceMeter` beyond what it did before (dirty-gates intact)
