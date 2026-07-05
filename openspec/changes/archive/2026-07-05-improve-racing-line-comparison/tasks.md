# Tasks — improve-racing-line-comparison

## 1. Bridge broadcast rate

- [x] 1.1 Raise `BROADCAST_HZ` from 30 to 60 in `bridge/src/index.ts` and confirm with the mock (`npm run mock -w bridge`) that clients receive ~60 telemetry messages/s with keep-newest semantics intact

## 2. Zoom transform (track-map-zoom)

- [x] 2.1 Add zoom state (level + world focus) to `TrackMap`, reset alongside `resetLines()` on session change/restart, untouched on lap completion
- [x] 2.2 Attach a non-passive `wheel` listener on the canvas: exponential step per notch, clamp to [1, 40], cursor-anchored (world point under cursor stays fixed), `preventDefault()` so the page never scrolls; snapping to 1× discards the focus offset entirely
- [x] 2.3 Compose the zoom transform over the map.ini `project` closure and draw the map image through the same transform so image, lines, and dot stay registered
- [x] 2.4 Compose the same zoom transform over the fallback-mode `project` closure (multiplier on the eased auto-fit view), leaving the automatic camera behavior at 1× byte-identical to today
- [x] 2.5 Keep stroke widths, dot radius, and hover pick radius constant in screen pixels at every zoom level

## 3. Per-lap colors and legend (lap-line-comparison)

- [x] 3.1 Define the 6-hue palette (no green/red/yellow — reserved for the pedal gradient) and color the 6 most recent completed laps by stable `lap % 6` assignment; older laps keep the faint grey
- [x] 3.2 Replace the fixed-blue hover highlight with thicken + full opacity in the lap's own color (grey laps brighten the same way)
- [x] 3.3 Add the DOM legend overlay to the map panel: swatch + lap number + lap-log time per colored lap (red when invalid, number-only when unrecorded), most recent first, hidden until a colored lap exists

## 4. Speed samples and hover readout (lap-line-comparison)

- [x] 4.1 Add `speedKmh` to `Sample` and record it raw from each frame when a sample is appended
- [x] 4.2 Extend the hover hit-test to also collect the nearest in-radius sample for every colored lap (keeping the existing nearest-lap result)
- [x] 4.3 Extend the hover label into a multi-row readout: nearest lap keeps "Lap N — time" (red when invalid), each in-radius colored lap adds a swatch-colored "Lap N · <speed> km/h" row
- [x] 4.4 Sanity-check hover-scan cost with a long mock session (many stored laps); only if frame time visibly drags, add a per-lap bounding-box early rejection

## 5. Verification

- [x] 5.1 `npm run lint -w web`, `npm run build -w web`, `npm run build -w bridge`
- [x] 5.2 With the mock: zoom into a corner (cursor-anchored, clamped, page never scrolls), scroll fully out and confirm exact fit framing returns, restart session and confirm zoom + lines reset
- [x] 5.3 With the mock: complete 3+ laps, confirm three distinct stable line colors, legend rows with times, hover readout listing per-lap corner speeds, and highlight in the lap's own color
- [x] 5.4 Confirm every interaction works while the browser window is unfocused — hover and wheel only, zero clicks anywhere
