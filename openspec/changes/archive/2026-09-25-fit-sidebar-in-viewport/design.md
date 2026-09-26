## Context

The desktop sidebar (`App.tsx`, the `lg:grid-cols-[24rem_1fr]` left column) is a `flex-col gap-3
overflow-y-auto` stack of four children, all with fixed heights. Measured in the demo build with
puppeteer at 1911×909 (the user's 1080p browser window):

```
column visible 794 px · content 847 px · width 384 px
  InstrumentCluster        239
  LapTimes (2×2 + Lap)     218   = 78 + 8 + 78 + 8 + 46
  PedalTrace               170   (canvas h-28) — removed by this change
  G-force | Steering row   184   (grid-cols-[10rem_1fr]; Steering card is ~66 of it)
  gaps                      36
```

Column height available at other viewports: 1920×945 → 830, 1536×730 → 615, 1366×650 → 535.
Fixed heights make any single cut fragile. Removing the Lap tile alone leaves 793 vs 794.

## Goals / Non-Goals

**Goals:**
- No sidebar scroll on desktop viewports from 1366×650 up to 1920×1080.
- Keep every piece of information: lap number, all lap times (flyout), steering, G-force, current pedal position (pedal *history* stays on the map line and in lap analysis).
- Keep the render-efficiency guarantees. No new per-frame work, and the dirty-gates stay intact.

**Non-Goals:**
- The stacked layout below `lg`: it keeps `overflow-y-auto` and scrolls as today.
- Restyling the gauges or shrinking the timing typography. The spec calls both "prominent".
- The right column (track map / lap analysis).

## Decisions

### 1. One elastic card; everything else fixed

```
┌──────────── InstrumentCluster (fixed) ────────────┐
│    (speed)                    (rpm / gear)         │
│  ABS  TC  PIT   ◀━━━━━━━━┿━━━━━━━━▶  0°             │
├────────────────────────┬──────────────────────────┤
│ LAP 3            INV   │ DELTA                    │  LapTimes (fixed)
│ 0:37.140               │ -0.12                    │
├────────────────────────┴──────────────────────────┤
│╎ LAST LAP              │ BEST LAP                ╎│  ← hover group (flyout opens above)
│╎ 1:42.118              │ 1:41.905                ╎│
├───────────────────────────────────┬───────────────┤
│ PEDAL TRACE  thr brk clu          │ G-FORCE       │  DriverInputs (flex-1 min-h-*)
│ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~      │     (•)       │
│ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~      │               │
└───────────────────────────────────┴───────────────┘
```

The sidebar stays `flex-col`. The new supporting card is `flex-1 min-h-<floor>`, and its canvases
fill it. Fixed budget ≈ 239 + 164 + 2×12 = 427 px. The card gets ~367 px at 1080p, ~188 px at
1536×730 and ~108 px at 1366×650.

*Alternative rejected:* tuning fixed heights so they fit one screen. That only works at one
viewport height, and the user wants laptops covered.
*Alternative rejected:* making every card shrink proportionally. The gauges and timing digits
would shrink with the window, and the spec wants them prominent.

### 2. Steering joins the status-light row

The ABS/TC/PIT row sits `justify-center` with ~200 px of dead space. It becomes `flex`: the lights
on the left and a compact steering bar (`flex-1`) with its degree readout on the right. It sits on
one line with no "Steering" caption; the centered zero tick and the ° readout make it
self-explanatory. `SteeringBar` keeps its data logic (`MAX_DEG`, fraction math) and gets a compact
single-line layout. It is only used here, so there is no variant prop. The height cost is about
0–6 px.

*Alternative rejected:* putting steering inside the new supporting card as a strip under the
trace. That takes height from the one elastic element, the thing we are short of.

### 3. Pedal trace removed; G-force + live pedal bars in one card

*First applied as "G-force beside the pedal trace". At ~198 px wide × 300 px tall the trace
read as a barcode (12 s over 198 px, with near-binary pedals in the demo car), so the user chose
to drop it.*

New `DriverInputs.tsx` renders the single `<section>` card: `grid-cols-[1fr_auto] grid-rows-1`,
with `GForceMeter` filling the left column and `PedalBars` (two `w-2` vertical bars, throttle
`bg-good` / brake `bg-critical`, value on top and label below) on the right. `GForceMeter` drops
its own `<section>` chrome, and its canvas is `flex-1 min-h-0`. Its dirty-gate already compares
`clientWidth` / `clientHeight` / DPR, so resizing costs one repaint per size change.
`GForceMeter` sizes its rings from `Math.min(width, height)` and centers them, so the meter stays
circular for any box aspect.

The bars read `gas` / `brake` from the throttled `telemetry` state, the same as `SteeringBar`.
They are two DOM heights at ~30 Hz, with no canvas and no ref. `App` already re-renders at that
rate. There is no CSS transition, because it would lag the reading behind the input.

`useInputHistory` loses `gas` / `brake` / `clutch`, and `CAPACITY` drops from 360 (12 s) to 60
(~2 s). The G meter draws the whole buffer, so `PATH_SAMPLES` goes away.

*Alternative rejected:* keeping the trace and widening it by shrinking the G column. A time series
in 250 px is still hard to read, and the map line and lap analysis already carry pedal history
anchored to track position, which is the more useful axis.
*Alternative rejected:* the G meter inside the cluster. Two ~160 px gauges already fill the 352 px
content width.

### 4. Lap tile removed; the flyout moves to the Last/Best pair

- The Current-lap tile label becomes `Lap {lapCount + 1}` (`Lap –` without telemetry). The existing
  INV chip still renders after it.
- Last and Best render inside one `col-span-2 grid grid-cols-2 gap-2` wrapper, which carries
  `HOVER_GROUP_CLASS relative`, the `onPointerUp` tap/click toggle, and `LapListPanel` (unchanged,
  still `absolute bottom-full`). One wrapper means the 8 px gap between the tiles is part of the
  hover target, so moving Last → Best never closes the panel. The panel is a descendant, so hovering
  it keeps `group-hover` alive as it does today. The hover affordance moves to both tiles
  as `hover:` + `group-hover:border-accent/60`. In hover mode they light together through the group.
  In click mode `HOVER_GROUP_CLASS` is empty, so each tile lights on its own `hover:`.
- `hoveredLapRef` handling is untouched, so cut-marker reveal on row hover keeps working.

*Alternative rejected:* all four tiles as the trigger. Current/Delta are glanced at constantly, and
opening a 256 px panel over the cluster each time would be noise.
*Alternative rejected:* dropping the flyout because `LapAnalysis` chips list laps. The chips show
only laps with complete recordings, and the flyout shows every logged lap with validity colors.

### 5. The floor on the elastic card

`min-h` on `DriverInputs` is set so that 1366×650 (535 px column) still fits: 427 + floor ≤ 535 →
floor ≤ ~100 px. Use `min-h-24` (96 px) as the starting value. The floor exists so a shorter window
degrades to a scroll instead of collapsing the charts to nothing.

## Risks / Trade-offs

- [At 1366×650 the charts are ~50 px tall and the G circle is small] → Acceptable at the floor of
  the range. If it reads badly in verification, the next lever is tightening the timing tiles'
  vertical padding (`py-3` → `py-2`, ~16 px back), not shrinking the digits. **Applied:**
  measured canvases at 1366×650 were 34 px before and 66 px after.
- [The pedal column was ~198 px and the trace unreadable] → Superseded by Decision 3: trace removed.
- [At 1080p the G column is tall with a width-bound circle and empty space above and below] → The
  circle is vertically centered. If it looks unbalanced, widen the G column within the ~9 rem cap
  before touching anything else.
- [Hover target moves: muscle memory expects the Lap tile] → Last/Best get the same accent-border
  hover cue the Lap tile had.
- [The flyout now covers Current/Delta and the lower cluster while open] → It already covered the
  timing tiles. It is transient and reveal-only.
- [The combined card changes `GForceMeter` markup] → Its draw loop is untouched.
  Only the wrapper and the canvas sizing classes change.

## Migration Plan

UI-only, with nothing persisted and no wire change. Rollback is reverting the commit.
