## 1. Telltales

- [x] 1.1 Restyle `StatusLight` in `InstrumentCluster/index.tsx`: unlit means no background (`text-ink-secondary` when enabled, `text-ink-muted opacity-40` when disabled), lit keeps `${activeClass} text-page`
- [x] 1.2 Put ABS, TC and PIT in one 3-column row under the tachometer, and drop PIT's `col-span-2`

## 2. Car glyph

- [x] 2.1 Create `InstrumentCluster/CarSlipGlyph.tsx`: an inline SVG with a top-down chassis outline (`--color-edge`, narrower nose at the top) and four tyres in FL/FR/RL/RR positions, each with a `<title>` from `WHEEL_LABELS`
- [x] 2.2 Fill each tyre: muted with no telemetry, `--color-hairline` when dark, warning when lit, critical when lit and `tyreSlip[i] >= SLIP_CRITICAL`
- [x] 2.3 Feed it `useWheelSlipLamps`' booleans and `telemetry?.tyreSlip`, and remove the four wheel `StatusLight`s

## 3. Pedal lamps

- [x] 3.1 Create a vertical on/off pedal lamp component (thin bar, small label underneath, `aria-label`): `bg-good` / `bg-critical` when lit, `bg-hairline` when dark
- [x] 3.2 Lay out `[THR] [car glyph] [BRK]` beneath the telltale row, with the bars as tall as the glyph's wheelbase, and remove the THR/BRK `StatusLight`s

## 4. Verification

- [x] 4.1 Run `/opsx:verify`: bridge and web typecheck, lint, formatting and the spec deltas
- [x] 4.2 With `npm run mock -w bridge` and `npm run dev` running, confirm a tyre on the car glyph turns amber during the mock's slip excursions and goes dark afterwards, and that the hover overlay shows that same wheel in its warning grade at the same moment
- [x] 4.3 With the mock running, confirm THR lights green on throttle and BRK red on braking as full-height bars, never partly filled
- [x] 4.4 At 1920×1080 and 1366×650, measure the cluster's two columns with `getBoundingClientRect`: the right column must not be taller than the speedometer
- [x] 4.5 At 1366×650, confirm whether the G-force meter is now visible (it hid there before because the card got less than about 160 px), and report the card's height either way
- [ ] 4.6 Before the first frame arrives (bridge up, mock stopped), confirm the four tyres render muted, both pedal lamps are dark, and the console shows no errors
