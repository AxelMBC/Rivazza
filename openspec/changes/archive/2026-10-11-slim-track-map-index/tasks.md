# Move the legend, follow button and pedal key out of TrackMap's index and gate its repaints on one input tuple

## 1. Legend

- [x] 1.1 `TrackMap/legend.ts`: the `LegendEntry` type, `legendEntries(previousLaps, laps)` and `legendKey(entries)`,
      with the body of today's `syncLegend` (`index.tsx:260-281`) unchanged (design D1)
- [x] 1.2 `TrackMap/LapLegend.tsx`: `LapLegend({ entries })` with the markup from `index.tsx:496-530`, including the
      `entries.length > 0` guard
- [x] 1.3 `index.tsx`: `syncLegend` calls `legendEntries` and `legendKey` and keeps the `legendKeyRef` compare and
      `setLegend`. The JSX renders `<LapLegend entries={legend} />`. Drop the imports that only the legend used

## 2. Overlay controls

- [x] 2.1 `TrackMap/PedalKey.tsx`: the three swatches rendered from one list, same order and markup (design D3). The
      "No map file" notice stays in `index.tsx`
- [x] 2.2 `TrackMap/FollowButton.tsx`: the bottom-left container and button from `index.tsx:531-562`, taking
      `followUi`, `dwelling`, `hasFrame` and `follow`, with the visibility rule inside (design D2)
- [x] 2.3 `index.tsx` renders both. Drop `CLICK_MODE`, `DWELL_FILL_CLASS` and the palette imports if nothing else
      uses them

## 3. Dirty gate

- [x] 3.1 Replace the 15 `last*` mirrors and `firstDraw` with `lastInputs` and the tuple from design D4. The tuple
      holds exactly the 15 values compared today (`index.tsx:340-354`). The motion flags stay as separate terms
- [x] 3.2 `syncSectorTables()`, the `insetRef.current = null` reset and the canvas resize keep their place after the
      gate

## 4. Verification

- [x] 4.1 Run `/axl:verify`
- [x] 4.2 Session running, mouse off the map, game paused: in the DevTools Performance panel the map stops
      repainting (rAF callbacks return at the gate). Unpause and the dot moves again
- [x] 4.3 After completing a lap: the legend shows it with its colour and time, and an out/in lap shows its
      `OUT`/`IN` tag. Hovering the lap's line gives the pointer cursor and readout, and hovering its row in the session
      lap list highlights the same line
- [x] 4.4 Wheel zoom repaints at once with the game paused, and the overview inset appears from the second notch.
      Resizing the window repaints the map at the new size
- [x] 4.5 Pedal key shows Throttle, Coast and Brake in the same colours. "Follow car" appears only once telemetry
      arrives, a 1 s rest engages follow (the bar fills, the camera glides in), and a 1 s rest on "Exit follow" glides
      back
- [x] 4.6 Scrubbing the analysis panel moves the scrub marker on the map, and a cut shows its red × on the
      in-progress lap
