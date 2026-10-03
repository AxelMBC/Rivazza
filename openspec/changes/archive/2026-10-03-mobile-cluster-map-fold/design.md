## Context

`App.tsx` renders the session dashboard as `main.grid.grid-rows-[35fr_65fr]` below `lg` and
`lg:grid-cols-[24rem_1fr]` at `lg`. It has two column wrappers: the sidebar (cluster, lap tiles,
DriverInputs, `overflow-y-auto`) and the right column (TrackMap, LapAnalysis). Below `lg` those
wrappers become the 35 % and 65 % rows. On an iPhone SE the cluster alone is ~250 px tall, so the
35 % row (~190 px) clips it and the speedometer scrolls inside its card (the screenshot in the
request).

The root is `div.flex.h-full.flex-col.overflow-hidden` with `html, body, #root { height: 100% }`.
In iOS Safari `100%` of the root resolves against the initial containing block, i.e. the small
viewport (toolbars showing), which is what the fold has to fit.

The cluster's height is set by its right column — tachometer, status-light row, car glyph and
pedal lamps stacked, ~213 px at phone width — not by the speedometer. Narrowing the gauge row only
shrinks the speedometer beside an unchanged column (measured during apply), so gauge scaling cannot
buy fold height.

The desktop sidebar fit (`2026-09-25-fit-sidebar-in-viewport`) is carefully tuned: DriverInputs is
the only flexible element and hides the G-meter under ~160 px. It must not move.

## Goals / Non-Goals

**Goals:**

- Phone first screen = cluster in full + track map filling the rest, sized against the small
  viewport.
- One page scroll below `lg`; no card scrolls internally.
- Below-fold order: lap tiles, G-force card, lap analysis.
- Desktop pixel-identical.

**Non-Goals:**

- Redesigning the session header for phones (`responsive-header` stays as specified). It is part of
  what the fold must leave room for, not something this change shrinks.
- Letting a swipe that starts on the track map scroll the page — the map keeps `touch-none` for its
  pinch/pan gestures (`touch-interaction`).
- Tablet-specific layouts; everything below `lg` gets the phone layout.

## Decisions

### 1. `main` becomes the scroll container below `lg`; the fold is `h-full` inside it

`main` already gets exactly "viewport minus header" from `flex-1 min-h-0` in the `h-full` root.
Below `lg` it becomes `flex flex-col overflow-y-auto`, and a fold wrapper inside it is
`h-full shrink-0` — so the fold equals the space under the header with no measurement, no
ResizeObserver, and no header-height constant that the wrapping header would invalidate.
Landscape: the fold gets `min-h-fit` and the map a 160 px minimum, so a fold that can't fit grows
and `main` scrolls.

_Alternative:_ page-level scroll (`body`) with the fold at `calc(100svh - <header>)`. Rejected: the
header's phone height varies with wrapping pills and long names, so the subtraction would need a
measured CSS variable.

### 2. Cluster and map share a fold wrapper that is `display: contents` at `lg`

The fold must hold the cluster (desktop sidebar) and the map (desktop right column), which no
current wrapper contains together. The DOM becomes:

```
main (below lg: flex-col scroll · lg: grid areas)
├─ fold        (below lg: flex-col h-full · lg: contents)
│  ├─ InstrumentCluster   lg: area cluster
│  └─ TrackMap            lg: area map   (flex-1, min-h 160px below lg)
├─ LapTimes               lg: area laps
├─ DriverInputs           lg: area inputs
└─ LapAnalysis            lg: area analysis
```

At `lg`, `main` reproduces today's two columns with a grid:
columns `24rem 1fr`, rows `auto auto 1fr auto`, areas
`"cluster map" "laps map" "inputs map" "inputs analysis"`. DriverInputs spans rows 3–4 and fills
the sidebar's leftover height exactly as `flex-1` did; the map spans rows 1–3 and LapAnalysis sits
under it, as in the right column today. The current gaps (sidebar `gap-3`, right column `gap-4`)
are kept by `gap-x-4 gap-y-3` plus a 4 px top margin on LapAnalysis at `lg`.

_Alternative A:_ keep both column wrappers and make them `contents` below `lg`, ordering children
with `order-*`. Rejected: the cluster and map then sit loose in `main`, and the map's height would
have to be "fold minus the cluster's height", which CSS can't express without measuring.

_Alternative B:_ switch between two JSX trees with a `matchMedia` hook. Rejected: crossing `lg`
(rotating a tablet) would remount `TrackMap` and drop its line recorder's stored laps.

### 3. Phone-only spacing trims buy the fold's height; the map floor is 160 px

Measured at 375×553: header 117 px + the full cluster 247 px leaves the map ~140 px under desktop
spacing. Below `lg` the page padding and gaps go from 16 to 12 px, the cluster's padding from 16 to
12 px and its right-column gap from 8 to 6 px (all restored with `lg:` classes). That gives the map
177 px at 375×553 and 279 px at 375×667, so the map's minimum is set at 160 px.

_Alternative:_ cap the gauge row's width with `svh`. Tried and rejected — see Context. _Alternative:_
compact the phone header (~40 px more). Rejected for scope: `responsive-header` stays as specified.

### 4. Below-fold cards take natural heights

LapTimes is already natural. DriverInputs keeps its existing phone `h-42` slot (`lg:` classes
switch it to the flexible desktop card), where the G-meter already renders square. LapAnalysis keeps its collapsed summary bar; its upward
flyout (`bottom-full`, `max-h-[42vh]`) opens over the cards above it within the scroll container.

## Risks / Trade-offs

- [The desktop grid rewrite shifts a pixel somewhere and the 1366×650 G-meter threshold flips] →
  Measure the sidebar card heights at 1366×650, 1536×730 and 1920×945 before and after with the
  verify skill's puppeteer setup; they must match.
- [A swipe starting on the map does not scroll the page, and the map is the larger half of the
  fold] → Accepted: the header and the cluster remain swipe handles, and pinch/pan on the map is
  more valuable than scroll-through. Recorded in the spec scenario.
- [The cluster's tap-to-toggle tyre overlay fires when a swipe on the cluster starts a scroll] →
  The browser sends `pointercancel`, not `pointerup`, once a pan becomes a scroll, so
  `onPointerUp` does not fire; confirm on the device.
- [LapAnalysis's upward flyout can extend above the scroll container's visible top when the bar is
  near the top of the screen] → It is capped at `42vh` and the user has scrolled down to reach the
  bar; verify it is readable at 375×667.
- [Because `main`, not the document, scrolls, iOS Safari never collapses its toolbars] → Accepted:
  it is what keeps the fold's small-viewport sizing exact; the dashboard already never scrolled the
  document.
