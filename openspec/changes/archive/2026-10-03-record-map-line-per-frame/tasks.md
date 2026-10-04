# Record the track map's driven line per telemetry message, not per repaint

## 1. Per-message ingest

- [x] 1.1 Add a `subscribeFrame` prop to `TrackMap` (`web/src/components/TrackMap/index.tsx`) typed like `Telemetry["subscribeFrame"]`, and pass it from `web/src/App.tsx`
- [x] 1.2 In `TrackMap`, add a component-level effect that subscribes `frame => lines.ingest(frame, cutsRef.current, resetLines)` and returns the unsubscribe
- [x] 1.3 Remove the `lines.ingest(...)` call from the rAF tick, and keep `frame !== lastFrame` in the dirty gate

## 2. Current-lap cache survives unseen rollovers

- [x] 2.1 In `web/src/components/TrackMap/layers.ts`, track the sample array the current-lap cache was built from, and reset `currentPaths`, `currentPathCount` and `appendedCount` when `currentRef.current` is a different array (replacing the `layerLen < currentPathCount` / `layerLen < appendedCount` length checks)

## 3. Verification

- [x] 3.1 Run `/axl:verify`
- [x] 3.2 With `npm run mock -w bridge` and `npm run dev`, cover the dashboard tab (switch to another tab) for ~20 s mid-lap, then return: the current lap's line is continuous through the hidden stretch, with no gap or straight chord, and its pedal colours change along it as usual
- [x] 3.3 Same setup, keep the tab hidden for longer than one full mock lap, then return: the finished lap appears as a stored lap in its identity colour, and the current-lap line starts at the finish line with no leftover segment from the previous lap
- [x] 3.4 With the tab visible, let the mock's periodic fake cut fire: the red × still appears at the cut position while that lap is in progress
- [x] 3.5 Run `npm run dev:demo` and watch one replayed lap: the line draws as before, and the demo's loop-back reset clears it
