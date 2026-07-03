# Tasks — racer-stats-ui

## 1. Extended telemetry (bridge + shared types)

- [x] 1.1 Extend `TelemetryFrame` in `bridge/src/types.ts` with clutch, steerAngle, accG (frontal/horizontal/vertical), absEnabled/absInAction, tcEnabled/tcInAction, inPit, engineLimiterOn, carSlope, tyreSlip[4], wheelLoad[4]
- [x] 1.2 Extend `parseRTCarInfo` in `bridge/src/parsers.ts` to decode the new fields at their struct offsets (bools 20–25, accG 28/32/36, clutch 64, steer 72, tyreSlip 148, load 180, carSlope 312)
- [x] 1.3 Mirror the extended `TelemetryFrame` in `web/src/types.ts`
- [ ] 1.4 Verify against a live AC session that new fields read sane values (G-forces near 1G vertical at rest, steer sign, ABS/TC flags toggling); adjust offsets if any read garbage

## 2. Gradient driving line (track map)

- [x] 2.1 Replace trail/breadcrumb refs in `TrackMap.tsx` with a per-lap sample list `{x, z, gas, brake}`, sampled on >0.5 m movement (~2–3 m spacing for very long laps), cleared on `lapCount`/session change
- [x] 2.2 Add segment color function: red when brake dominates above dead-zone, green when throttle above dead-zone, yellow when coasting; lerp intensity by pedal magnitude
- [x] 2.3 Draw the full-lap gradient polyline in map-image mode (projected via map.ini meta) with the car dot on top; remove the old fading trail
- [x] 2.4 Apply the same gradient line in fallback breadcrumb mode (auto-fit bounds, gradient line doubles as the outline)

## 3. Input history + delta infrastructure (web)

- [x] 3.1 Add `useInputHistory` ring buffer (~360 samples: t, gas, brake, clutch, accGH, accGF) appended per telemetry frame, exposed as a ref for rAF consumers
- [x] 3.2 Add `useLapDelta` hook: record (normalizedPos, lapTimeMs) per lap, promote to reference on new-best lap completion with coverage guard, compute live interpolated delta, return null until a reference exists

## 4. Dashboard components

- [x] 4.1 Build `InstrumentCluster.tsx`: large gear, speed, RPM bar with redline zone (rolling session-max scale, 8k floor) and limiter flash via CSS animation
- [x] 4.2 Add ABS / TC / PIT status lights to the cluster (bright when in action, dim when enabled-idle, muted when disabled)
- [x] 4.3 Build `PedalTrace.tsx`: canvas scrolling 10s+ time-series of throttle/brake/clutch, colors matching the driving-line convention, safe when empty
- [x] 4.4 Build `GForceMeter.tsx`: canvas lateral-vs-longitudinal dot with 1G/2G rings and faint recent path
- [x] 4.5 Build `SteeringBar.tsx`: centered horizontal deflection indicator from steerAngle
- [x] 4.6 Add live delta readout to `LapTimes.tsx` (signed seconds, faster/slower colors, "––.––" placeholder)

## 5. Layout, styling, cleanup

- [x] 5.1 Rework `App.tsx` into the three-zone racer layout (cluster + timing + trace + G/steering left, gradient map right), single non-scrolling viewport on desktop; keep waiting screen unchanged
- [x] 5.2 Add/alias theme tokens in `index.css` (redline, coast) and ensure tabular-nums across all numeric readouts
- [x] 5.3 Delete `LiveStats.tsx` and remove dead code/imports; run `npm run build` clean
- [ ] 5.4 End-to-end check with a live AC session: gradient line paints correct braking zones, lap reset clears the line, delta behaves across laps, no frame drops
