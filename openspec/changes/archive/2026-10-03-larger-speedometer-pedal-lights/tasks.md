## 1. Dominant speedometer

- [x] 1.1 In `InstrumentCluster/index.tsx`, change the gauge row from `grid-cols-2` to `grid-cols-[2fr_1fr] items-center` (speedometer first)
- [x] 1.2 Enlarge the speed readout pill to ~`text-2xl font-bold` (unit stays small), sized so "320 km/h" fits the lower dial window without overlapping the numerals
- [x] 1.3 If needed, reduce the gear numeral on the smaller tachometer so the speed readout is the largest numeral in the cluster

## 2. THR / BRK lights

- [x] 2.1 Add `PEDAL_ON_THRESHOLD = 0.05` and two `StatusLight`s after PIT: `THR` (`active` when `gas > threshold`, `bg-good`) and `BRK` (`active` when `brake > threshold`, `bg-critical`), both `enabled`
- [x] 2.2 Confirm `SteeringBar` still fills the remaining row width and its degree readout stays on one line
- [x] 2.3 Move the tachometer and the status lights (two-column grid: ABS TC / PIT / THR BRK) into one column to the right of the speedometer, removing the status row under the gauges; tachometer stays 113 px
- [x] 2.4 Move `SteeringBar` to `DriverInputs/` and render it as one full-width row (label, centred track with accent fill, angle) along the bottom of the G-force card

## 3. G-force-only supporting card

- [x] 3.1 Delete `DriverInputs/PedalBars.tsx`
- [x] 3.2 In `DriverInputs/index.tsx`, render only `GForceMeter` (drop the two-column grid and the `telemetry` prop); update the `<DriverInputs>` call in `App.tsx`
- [x] 3.3 Wrap the card in a `[container-type:size]` element taking the elastic slot (`lg:min-h-0`) and hide only the meter with `[@container(max-height:160px)]:hidden`, so a too-short slot shows the steering row alone instead of collapsed rings (a `lg:min-h-20` floor was tried first: it fits, but the meter is unreadable)

## 4. Verification

- [x] 4.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [x] 4.2 With `npm run dev:demo`, measure the sidebar column (puppeteer, as in the `fit-sidebar-in-viewport` archive) at 1920×1080, 1911×909, 1536×730 and 1366×650: `scrollHeight <= clientHeight` at every size; steering is visible at every size; the G-force circle is fully visible and round at the three larger sizes and hidden at 1366×650
- [x] 4.3 At those sizes, confirm the speedometer dial is wider than the tachometer (~2 : 1; measured 225 / 113 px) and the speed readout fits inside the dial window at three digits
- [ ] 4.4 With the mock running (`npm run mock -w bridge` + `npm run dev`), watch THR light green while accelerating and go dark when lifting, BRK light red while braking; neither flickers while coasting
- [ ] 4.5 Before any telemetry arrives, both pedal lights render dark and the speed readout shows "–" without errors
