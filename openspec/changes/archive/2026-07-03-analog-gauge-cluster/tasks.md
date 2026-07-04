# Analog Gauge Cluster — Tasks

## 1. Prerequisites

- [x] 1.1 Archive/sync the `racer-stats-ui` change so the `racer-dashboard` main spec exists (finish its remaining tasks or sync its delta specs first)

## 2. AnalogGauge component

- [x] 2.1 Create `web/src/components/AnalogGauge.tsx` with props `{ min, max, value, majorTickStep, minorTicksPerMajor, redlineFrom?, formatTickLabel?, flash?, children }` and a fixed 200×200 viewBox, 240° sweep (−120° to +120°)
- [x] 2.2 Add a `polarToCartesian` helper and generate major/minor ticks and numeral labels from scale props
- [x] 2.3 Render the dark face, bezel ring, and (when `redlineFrom` is set) a redline arc segment using theme tokens (`surface`, `edge`/`hairline`, `ink`, `redline`)
- [x] 2.4 Render the needle polygon + center hub, rotated from `value` (clamped to [min, max]), with `transition: transform 100ms linear` for smooth motion; support the `flash` prop (pulse in redline color)
- [x] 2.5 Render the `children` slot as the lower-face window (odometer position), centered below the pivot

## 3. InstrumentCluster rewrite

- [x] 3.1 Replace the speed/gear/RPM text row and RPM bar in `web/src/components/InstrumentCluster.tsx` with two `AnalogGauge` instances side by side (equal-width columns)
- [x] 3.2 Speedometer instance: scale 0–320, ticks every 40, window shows exact speed (`km/h`, tabular numerals; placeholder when telemetry is null)
- [x] 3.3 Tachometer instance: scale 0–10,000, ticks every 1,000 labeled ×1000, redline arc from 8,500, window shows the gear via `formatGear`, `flash` bound to `engineLimiterOn`
- [x] 3.4 Remove the now-unused rolling-max RPM logic (`RPM_FLOOR`, `maxRpmRef`) and keep the ABS/TC/PIT status-light row beneath the gauges
- [x] 3.5 Handle the no-telemetry state: needles at scale minimum, placeholder readouts, no errors

## 4. Layout & polish

- [x] 4.1 Constrain gauge size (max-width per dial) and adjust the dashboard left-column spacing so the full dashboard still fits a 16:9 desktop viewport without scrolling
- [x] 4.2 Visual pass against the reference: tick weight, numeral size, needle shape, bezel treatment — tune until it reads as a real instrument

## 5. Verification

- [ ] 5.1 Run the app with the mock bridge (`bridge/scripts/mock-ac.js`) and verify all delta-spec scenarios: normal driving, limiter flash, >320 km/h clamp, and no-telemetry rest state
- [ ] 5.2 Verify needle motion is smooth during acceleration/braking and that status lights still respond (ABS/TC active states, PIT)
