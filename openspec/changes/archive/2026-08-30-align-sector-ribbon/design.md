## Context

`LapAnalysis.tsx` renders two independent things that describe the same x-axis:

- A canvas holding three strips, each plotted with
  `plotX(pos) = PAD_X + pos * (width - PAD_X * 2)`.
- A DOM flex row holding the mini-sector ownership ribbon, whose width is
  `contentWidth − captionWidth − 128 (w-32 readout) − 2 × gap-3`.

```
section.p-3 ── content box W ─────────────────────────────────────────┐
│ ┌ canvas (size-full) ───────────────────────────────────────────┐   │
│ │◄PAD_X=10                                          PAD_X=10►   │   │
│ │  SPEED ∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿∿   311 km/h    │   │
│ │  THROTTLE / BRAKE ▮▮ ▮ ▮▮▮ ▮ ▮▮▮▮ ▮ ▮▮ ▮ ▮▮▮ ▮ ▮▮▮▮ ▮ ▮▮ ▮   │   │
│ │  DELTA TO REFERENCE ──────────────────────────────    ±0.5s   │   │
│ └───────────────────────────────────────────────────────────────┘   │
│  SECTORS  ⟵gap-3⟶ ███████████ flex-1 ███████████ ⟵gap-3⟶ [w-32]    │
│           ▲ starts late                       ends 128px early ▲    │
└─────────────────────────────────────────────────────────────────────┘
```

The sector *data* is already correct and already on the traces' axis: slice `i`
spans normalized spline positions `[i/24, (i+1)/24]`, which is a fixed stretch of
tarmac, and the traces are plotted against the same `pos`. Nothing in
`lib/lapAnalysis.ts` is wrong. The defect is entirely that the two are drawn against
different rulers.

Constraints inherited from the repo:

- Canvas components are dirty-gated (`render-efficiency`); `LapAnalysis` additionally
  caches its traces in an offscreen layer keyed on
  `version|selLap|refLap|WxH@dpr`, so a scrub frame is a blit plus overlay.
- Interaction is hover-only in live builds — clicks steal game focus. Touch is
  handled by an explicit `touchstart`/`touchmove` scrub path.
- Colors come from semantic tokens in CSS; canvas code uses the established literal
  convention (`THROTTLE_TRACE`, `BRAKE_TRACE`, …) plus `lapColor()` for identity.

## Goals / Non-Goals

**Goals:**

- Slice boundaries land at the same x as the matching normalized position in the
  speed, pedal and delta traces — and stay there across resize and restyle.
- One scrub gesture answers speed, pedals, delta and "which sector is this" at once.
- Preserve the cached-layer/dirty-gate performance shape.

**Non-Goals:**

- Changing what a sector is. `SECTOR_COUNT = 24` equal slices stay; corner-derived
  segmentation and AC's own 3 sectors are both out of scope.
- A second, selection-following sector row. The ribbon stays session-ownership only,
  as `mini-sector-timing` already requires.
- Always-on boundary gridlines through the traces.
- Touching `lib/lapAnalysis.ts`, the bridge, or the wire contract.

## Decisions

### Ribbon becomes a fourth canvas strip, not a repositioned DOM element

The alternative was keeping the DOM ribbon and fixing its box: move the caption and
readout into a row above it, pad its container to `PAD_X`, and drive a shared cursor
from an absolutely positioned element over a `relative` wrapper containing both.

Rejected because it encodes the plotting range in two places — `PAD_X` as a canvas
constant and a matching CSS padding — that must agree forever. The spec now demands
alignment "by construction"; a shared `plotX` inside one canvas satisfies that, two
agreeing constants do not. Moving into the canvas also makes the cursor extension
a single changed y-coordinate rather than a new overlay element, and it matches the
existing idiom where strip captions are already drawn on the canvas.

The cost is 24 DOM hover targets. Replaced by arithmetic — see below.

### Sector index is derived from the scrub position, not from hover targets

`scrubAt` already computes `pos ∈ [0,1]` from `offsetX`. The hovered slice is
`Math.min(SECTOR_COUNT - 1, Math.floor(pos * SECTOR_COUNT))` — the clamp matters only
at `pos === 1`. This is strictly better than per-slice `mouseenter`: it resolves at
pointer resolution rather than slice resolution, it works when the pointer is over
the speed trace rather than over the ribbon, and it deletes the `hoveredSector`
React state along with a re-render per slice crossing.

Consequence, accepted deliberately: pointing at a sector now also moves the track-map
scrub marker, because both derive from one position. That is a feature — it shows
where on the circuit the hovered sector physically is.

### Layout: fixed ribbon thickness, proportional traces

`layoutStrips` currently divides `avail = height − PAD_TOP − PAD_BOTTOM − 2×STRIP_GAP`
into 0.42 / 0.24 / 0.34. It gains a fourth strip whose height is a **constant**
(`RIBBON_H`), subtracted from `avail` before the proportional split, plus a third
`STRIP_GAP`. The ribbon must stay legible as a color band at any panel height, and
scaling it proportionally would make it hairline-thin on short viewports; the trace
strips are the ones that benefit from extra height.

The canvas wrapper's `h-24 lg:h-28` grows to accommodate `RIBBON_H + STRIP_GAP`.

### Ribbon lives in the cached trace layer; band, cursor and readout in the overlay

Ownership colors depend only on `recordings` + `laps`, so the ribbon draws inside
`renderTraces` and costs nothing per scrub frame. The hovered band, the extended
cursor and the sector caption depend on `mousePos` and therefore belong in
`drawScrubOverlay`, which already repaints per position change.

`version` alone is **not** a sufficient cache key for the ribbon. The file's existing
comment on why the sector tables are not memoized says why: a lap's invalid flag can
land in the lap log frames after its recording is stored, with no version bump. That
dims a slice and adds its invalid bar, and a layer keyed only on `version`
would keep showing the stale slice until the next lap completed. So `layerKey` and
the dirty gate both take an `ownersKey` fingerprint (`lap` + an invalid marker per
slice, joined). It rebuilds the layer exactly when ownership actually changes and
never on a scrub frame — the property the cache exists for — at the cost of building
a 24-entry string per drawn frame.

This means the band is composited **over** the traces and ribbon rather than behind
them. A low-alpha white fill reads as a highlight rather than a veil and keeps the
layer cacheable; drawing it behind would force a layer rebuild on every pointer move,
which is precisely what the cache exists to avoid.

### Sector readout is a right-aligned caption, not a fourth tooltip row

The scrub tooltip is a floating box that already carries up to three rows and follows
the pointer. Adding sector ownership there would grow a box that flips sides near the
canvas edge. A caption on the `SECTORS` line — left label, right readout — mirrors
`SPEED … 311 km/h` and `DELTA TO REFERENCE … ±0.5s` exactly, sits at a stable
position, and is where a reader already looks for per-strip metadata.

Format keeps the existing content: `S12 · Lap 2 · 3.482`, with the time in the
critical tone and an `inv` suffix when the owner is an invalid lap. An unowned slice
renders no readout.

## Risks / Trade-offs

- **Panel gets taller, and it is an overlay floating over the track map.** The
  section is capped at `max-h-[42vh]` with `overflow-y-auto`; a taller canvas eats
  more map on short viewports. → Ribbon thickness is a small fixed constant and the
  existing `lg:` breakpoint keeps the short-viewport case near today's height.

- **Sector caption and the `311 km/h` / `±0.5s` captions could collide** if the
  readout is long. → The readout is bounded (`S24 · Lap 99 · 12.345 inv`) and lives
  on its own caption line above the ribbon, not shared with another right-aligned
  value.

- **Losing DOM ribbon elements removes any non-pointer affordance.** → There was
  none to begin with; the ribbon was already `mouseenter`-only and the repo is
  explicitly hover-only. Touch keeps working through the existing `touchstart` /
  `touchmove` scrub path, which now covers the ribbon area for free.

- **The band highlights a slice even where no lap has covered it.** → Band is purely
  positional and always valid; only the *readout* is suppressed for an unowned slice.

- **Regression risk in `layoutStrips` consumers.** `drawScrubOverlay` hardcodes the
  cursor's end at `strips.delta.top + strips.delta.h`. → That expression must move to
  the ribbon strip's bottom; it is the one place the three-strip assumption is baked
  into the overlay.

## Migration Plan

Single-commit, presentation-only change confined to `LapAnalysis.tsx`. No data
migration, no persisted state, no wire-format change. Rollback is a revert.

Verification is manual against the mock (`npm run mock -w bridge` + `npm run dev`,
per the `verify` skill): drive two laps, hover the analysis bar, scrub the traces and
confirm (a) a slice boundary sits under the matching point of the speed trace,
(b) the cursor is unbroken from speed through the ribbon, (c) the band tracks the
pointer, (d) the readout names the slice and owner, (e) the track-map marker follows,
and (f) resizing the window keeps the ribbon flush with the traces at both ends.

## Open Questions

None blocking. Two judgement calls left to implementation:

- Exact `RIBBON_H` (starting point: the current `h-3` ≈ 12 px) and the matching
  canvas height classes.
- Whether the hovered band gets a subtle 1 px edge on its boundaries or is a plain
  fill — decide against the mock, at full width.
