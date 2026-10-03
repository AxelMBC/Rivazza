## Context

`InstrumentCluster/index.tsx` renders every light through one `StatusLight` pill in a 2-column grid
under the tachometer: ABS TC / FL FR / RL RR / PIT (spanning both columns) / THR BRK. Every pill has a
`bg-hairline` fill even when it is unlit, so the nine of them read as a block of buttons.
`useWheelSlipLamps` returns four hysteresis-gated booleans. `constants.ts` holds `SLIP_ON`,
`SLIP_OFF`, `SLIP_CRITICAL` and `WHEEL_LABELS`, which the lamps and `TyreOverlay` share. The gauges
are SVG drawn with `--color-edge` outlines, `--color-hairline` fills and `--color-page` faces.

## Goals / Non-Goals

**Goals:**
- Make the status group look like part of the dials, not a row of buttons.
- Show which wheel is slipping by its position on a car, not by a text label.
- Shrink the group so the speedometer sets the cluster's height.

**Non-Goals:**
- Showing how far a pedal is pressed. THR/BRK stay on/off, by decision in explore.
- Changing slip thresholds, the hysteresis, `useWheelSlipLamps`' contract or the hover overlay.
- Any bridge, protocol or canvas change.

## Decisions

**1. One car glyph instead of four tyre icons.** Draw a single inline SVG: a chassis outline in
`--color-edge` and four rounded-rect tyres. An idle tyre is filled with `--color-hairline`, a lit one
with warning or critical. It lives in its own module (`CarSlipGlyph.tsx`) and takes the lamp booleans
and the raw slip array as props.
*Alternatives:* four separate tyre icons would still need labels and the 2×2 grid, so they save no
height. Restyling the pills would still leave nine cells in five rows. Either way the column stays as
tall as it is.

**2. The critical grade is derived in render, with no second hysteresis.** A tyre is critical when it
is lit **and** `tyreSlip[i] >= SLIP_CRITICAL`. This is the same comparison `TyreOverlay.slipClass`
makes, so the two can't disagree. `SLIP_CRITICAL` (3) is well above `SLIP_ON` (1.2), so a critical
tyre is always lit, and the amber↔red boundary is the only edge without hysteresis. Flickering
between two "slipping" colours is much less misleading than flickering on and off.
*Alternative:* extend `useWheelSlipLamps` to return a three-state value. Rejected: it changes a hook
contract to carry something the overlay already computes statelessly.

**3. Telltales: same `StatusLight` contract, different idle styling.** Keep the props `enabled`,
`active` and `activeClass` so the ABS/TC/PIT state logic doesn't move. Only the classes change: unlit
means no background (`text-ink-secondary` when enabled, `text-ink-muted opacity-40` when disabled),
and lit keeps `${activeClass} text-page`. ABS, TC and PIT go in one 3-column row.

**4. Pedal lamps are a separate small component, not a `StatusLight` variant.** A thin vertical bar
(about 6 px wide, as tall as the car glyph) with a tiny label underneath. It is on/off through a
boolean prop, using `bg-good` / `bg-critical` when lit and `bg-hairline` when dark. Keeping it apart
from `StatusLight` stops one component from needing orientation and fill-mode flags.

**5. Layout of the right column.** It becomes: tachometer, then the telltale row, then a row of
`[THR lamp] [car glyph] [BRK lamp]`. The target is about 80 px for the status group (down from
about 150 px), which keeps the column below the speedometer's height (the ADDED requirement).

**6. Colour-only encoding gets a text fallback.** Each tyre `<rect>` carries a `<title>` from
`WHEEL_LABELS`, and each pedal lamp carries an `aria-label`, so the information isn't conveyed by
colour alone.

## Risks / Trade-offs

- [Tyres too small to read at a glance] → Size the glyph so each tyre is at least about 8×14 px at
  1366 wide, and check it at both viewports during verify.
- [Red/amber is hard to tell apart for colour-blind drivers] → Critical is only an escalation:
  "slipping at all" is already shown by lit versus dark, which doesn't depend on hue.
- [Removing the FL/FR text makes the glyph less self-explanatory on first sight] → The car outline
  shows which end is the front (a narrower nose), and the hover overlay still labels every wheel.
- [The height goal depends on the speedometer's width at each breakpoint] → Verify it by measuring
  `getBoundingClientRect` of both columns at 1366×650 and 1920×1080, not by eye.
