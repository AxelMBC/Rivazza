# Fill the THR/BRK lamps in proportion to pedal pressure

## 1. Pedal lamps

- [x] 1.1 `PedalLamp` takes the raw input and owns the 5% dead zone and the 0–1 clamp; it draws a bottom-anchored fill scaled to that level (transform, no transition) over the `bg-hairline` track, and its accessible label carries the level as a percentage
- [x] 1.2 `InstrumentCluster` passes `telemetry?.gas` / `telemetry?.brake` and the fill colour classes; `PEDAL_ON_THRESHOLD` moves into `PedalLamp.tsx`

## 2. Verification

- [x] 2.1 Run `/axl:verify`
- [x] 2.2 In AC with the wheel and pedals: half throttle and half brake fill each lamp to about half its height, flat out fills it completely, a resting foot leaves it empty, and the fill tracks the pedal with no visible lag
