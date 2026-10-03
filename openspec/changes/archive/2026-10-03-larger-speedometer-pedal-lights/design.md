## Context

The sidebar is a fixed `24rem` column (`App.tsx`). Inside the cluster, two `AnalogGauge`s sit in a
`grid-cols-2` row (~170 px each after padding and the 12 px gap). `AnalogGauge` is an SVG with a
`viewBox` of 200 and `w-full`, so its rendered size is purely its grid column's width — no change to
the gauge itself is needed to resize it. The speed readout is a `text-sm` pill passed as `children`;
the gear is `text-3xl`.

Below the cluster, `DriverInputs` is one card: `GForceMeter` on the left and `PedalBars` (two
`w-8` columns) on the right. `fit-sidebar-in-viewport` made that card the sidebar's only elastic
element (`lg:flex-1 lg:min-h-24`) and measured it at 554 / 383 / 204 / 124 px for 1920×1080,
1911×909, 1536×730 and 1366×650.

The status-light row already holds `StatusLight` × 3 (ABS / TC / PIT) and `SteeringBar` filling the
rest of the row.

## Goals / Non-Goals

**Goals:**

- Speedometer visibly dominant and its digital readout readable at a glance.
- THR / BRK as binary lights that reuse the existing `StatusLight` look.
- Sidebar still fits without scrolling from 1366×650 to 1920×1080.

**Non-Goals:**

- Widening the sidebar (the track map keeps its width).
- Changing `AnalogGauge`'s geometry, scales, or needle animation.
- Partial / analog brightness for the pedal lights — on/off only, as requested.
- Renaming the `DriverInputs` folder now that it holds only the G-force meter (pure churn; revisit
  if the card gains something else).

## Decisions

**1. Split the gauge row 2 : 1 instead of 1 : 1.** `grid-cols-[2fr_1fr]` with `items-center`, so the
smaller tachometer centres vertically against the speedometer. At 352 px of content width the
speedometer grows from ~170 to ~225 px and the tachometer shrinks to ~113 px (a 3 : 2 split,
204 / 135 px, was tried first; the user traded tachometer legibility for the larger dial). Alternatives: a wider
sidebar (costs track-map width, user declined); scaling both gauges up (the row is width-bound, so
both cannot grow).

**2. Bigger speed readout.** The readout pill goes from `text-sm` to roughly `text-2xl font-bold`,
with the unit kept small beside it. It must still fit the lower dial window of a ~225 px dial
without colliding with the lower numerals; tune the size at implementation time against "320"
(three digits, worst case). The gear numeral on the now-smaller tachometer may need to drop from
`text-3xl` to `text-2xl` so the speed readout is the largest numeral, as the spec requires.

**3. THR / BRK reuse `StatusLight`.** Rendered as `enabled` always (like PIT), `active` when
`gas > 0.05` / `brake > 0.05`, `activeClass` `bg-good` / `bg-critical`. The 5% dead zone (a
module-level `PEDAL_ON_THRESHOLD` in `InstrumentCluster/index.tsx`) keeps pedal sensor noise and a
resting foot from flickering the light. They read the throttled `telemetry` state, the same source
as ABS/TC, so they update at ~30 Hz without a new rAF consumer.

**3b. Tachometer and lights stack in one column beside the speedometer.** The first
version kept a status row under both gauges (ABS, TC, PIT, THR, BRK, steering); the user found it
crowded and the gauge row left dead space under the smaller tachometer. The right-hand grid cell is
now a `flex-col`: tachometer (still 113 px — the user ruled out shrinking it further), a two-column
light grid (ABS TC / PIT spanning both / THR BRK, keeping pedals paired). `StatusLight` gains an
optional `className` for the `col-span-2`. Removing the row shortens the cluster from 295 to 259 px,
which goes back to the G-force card.

**3c. Steering lives in the G-force card.** Squeezed into the 113 px column the steering bar was
~65 px wide; the user moved it into the G-force card, where it gets the card's full width as one
row (`STEERING` label in the card-header style, a thin track with a centre mark and accent fill,
the angle on the right). One row rather than a header-plus-bar block: the stacked version cost the
meter ~28 px and collided its ring labels at 1536×730. `SteeringBar.tsx` moves to `DriverInputs/`,
which now takes `telemetry` again.

**4. Delete `PedalBars.tsx`.** `DriverInputs/index.tsx` drops its `grid-cols-[1fr_auto]`; the card
is a `flex-col` of the meter (`flex-1`) over the steering row. `GForceMeter`'s rAF loop and dirty gate are untouched.

**5. Hide the G-force meter when it can't be legible.** The cluster grows ~56 px, which comes
straight out of the elastic card. Measured at 1366×650 the card drops to ~68 px; its padding and
title take 58 px, leaving a ~10 px canvas whose rings collapse and whose labels overlap. Rather than
shrink it further, `DriverInputs` wraps the card in a `[container-type:size]` element that takes
the elastic slot (`lg:flex-1 lg:min-h-0`), and the meter's wrapper inside the card carries
`[@container(max-height:160px)]:hidden` (first the whole card hid at 120 px; once steering moved
in, hiding the card would have hidden steering too). With the meter gone the card is
`justify-center`, so the steering row sits in its middle. CSS decides from the slot's real height, so there is no JS
measuring and no extra rAF input; `GForceMeter`'s loop already returns early on a zero-size canvas
and repaints when it gets size back. The 160 px threshold keeps the canvas at ≥ ~70 px (measured 90 px at 1536×730). Below the
large breakpoint the slot is a fixed `h-42` (168 px), so the meter always shows there.
Alternatives: lowering the floor to `min-h-20` (tried — fits, but the meter is unreadable);
dropping the title and padding (wins ~30 px, still marginal).

## Risks / Trade-offs

- [Small laptops (1366×650) lose the G-force meter, keeping only steering in that card] → chosen by
  the user over a collapsed meter; it reappears on any taller viewport.
- [Removing the bars loses the exact pedal percentage live] → the lap analysis panel still plots
  throttle and brake per lap with scrub readouts.
- [Speed readout too wide for the dial window at three digits] → size it against the worst case
  ("320 km/h") during implementation.
