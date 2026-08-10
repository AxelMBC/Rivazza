## 1. Baseline

- [ ] 1.1 Capture a reference run: `npm run mock -w bridge` + `npm run dev -w web`, drive several
      laps, and screenshot the map at 1×, mid-zoom, and in follow mode
- [ ] 1.2 Add a temporary repaint counter to the rAF loop; record the idle repaint count over
      ~10 seconds (expected: flat) and the count during one lap at 1×
- [ ] 1.3 Create the `components/TrackMap/` folder, move `TrackMap.tsx` into it unchanged, update
      the import in `App.tsx`, and confirm build + lint + a visual run are identical

## 2. Extract pure geometry

- [ ] 2.1 `projection.ts`: base projections (map.ini, edge-bounds fit, driven-line auto-fit) and
      the `zoomed()` composition; export the `Project` type. Keep the exact `px = k·x + tx` form
      and the world +Z down-screen handedness in all three modes
- [ ] 2.2 `drivingLine.ts`: pedal color lerp, bucket quantization (`COLOR_QUANT`, `bucketKey`,
      `bucketColor`), world-space Path2D batching, and the held-back current-lap tail
- [ ] 2.3 `markers.ts`: cut ×, brake ticks (`computeBrakeTicks` and its hysteresis constants),
      the car heading wedge + steering tick, and the shared haloed ring
- [ ] 2.4 After each of 2.1–2.3: build, lint, visual run, and confirm the repaint counts from 1.2
      are unchanged. Commit separately

## 3. Extract stateful machinery

- [ ] 3.1 `layers.ts`: offscreen layer creation, `sizeLayer`, the `projKey` cache invalidation,
      and `appendedCount` / `lapsVersion` bookkeeping. Expose a factory called from inside the
      effect so state keeps exactly the effect's lifetime — never module scope
- [ ] 3.2 Verify layer invalidation: zoom, resize, and DPR change each re-render the ribbon and
      stored-lap layers exactly once, and an idle map still repaints zero times
- [ ] 3.3 `followCamera.ts`: dwell arming, the `off`/`following`/`detached`/`exiting` state
      machine, the delay buffer and interpolation, offset decay, and window clamping. Preserve
      the `followCamera(base, …)` → `zoomed(base)` call order exactly
- [ ] 3.4 Verify follow mode: hover-dwell arms at ~1 s, entry glides once, the car stays centred
      at racing speed at the tightest window, wheel/pinch retarget works mid-follow, and
      scrolling fully out lands on the exact 1× fit view

## 4. Extract interaction readout

- [ ] 4.1 `legend.ts`: hover picking (`HOVER_RADIUS_SQ`, the stride-3 scan), readout row
      assembly, and legend entry construction. Keep every `setState` call in `TrackMap.tsx`
- [ ] 4.2 Verify hover: line pick and readout rows at 1× and high zoom, focused-lap emphasis
      draws on top, brake ticks and cut markers reveal for the focused lap only, and follow mode
      still picks nothing

## 5. Finish

- [ ] 5.1 Remove the temporary repaint counter from 1.2
- [ ] 5.2 Delete comments the module boundaries now make redundant; confirm the survivors are
      external constraints or tuned-constant rationale per the `CLAUDE.md` comment rule
- [ ] 5.3 `npm run build -w bridge`, `npm run build -w web`, `npm run lint -w web`,
      `npm run format:check` all clean
- [ ] 5.4 Full end-to-end pass via the `verify` skill; compare against the 1.1 screenshots
- [ ] 5.5 Confirm no file in `components/TrackMap/` spans more than two capabilities; update the
      `CLAUDE.md` reference to this change
