## Why

The mini-sector ownership ribbon and the speed/pedal/delta trace strips share an
x-axis in the data (AC's normalized spline position) but not on screen. The traces
are drawn on a canvas inset by `PAD_X` on each side; the ribbon lives in a flex row
behind a `shrink-0` caption on the left and a `w-32` readout on the right. The two
rulers are offset by roughly a hundred pixels combined, so a slice boundary does not
land under the part of the speed trace it actually describes. The driver cannot look
at a dip in the speed line and see which sector owns it — which is the whole point of
having both on one panel.

The scrub cursor compounds it: it stops at the bottom of the delta strip, so while
scrubbing there is no indication of which sector the pointer is in.

## What Changes

- The sector ownership ribbon moves **into the analysis canvas** as a fourth strip
  plotted with the same `plotX` as the other three, making alignment exact by
  construction rather than by two constants agreeing.
- The scrub cursor extends through the ribbon, so one vertical line crosses speed,
  pedals, delta and sectors at the same track position.
- Hovering a point bands the containing slice's column across all four strips, tying
  the hovered speed/pedal/delta reading to a named sector.
- The sector ownership readout is derived from the scrub position (`floor(pos ×
  SECTOR_COUNT)`) instead of per-slice DOM `mouseenter`, and renders as a
  right-aligned caption above the ribbon — matching the existing `311 km/h` and
  `±0.5s` captions.
- The panel's canvas grows to fit the fourth strip; the ribbon keeps a fixed pixel
  thickness so the three trace strips absorb the remaining height at their current
  proportions.
- **Removed**: the DOM ribbon element, its 24 per-slice hover targets, and the
  `hoveredSector` React state.

Explicitly **not** changing:

- Sectors remain `SECTOR_COUNT = 24` equal normalized-position slices. They are
  already accurate stretches of track; only their drawing was wrong.
- The ribbon still shows session **ownership** and still ignores which lap is
  selected. No per-lap sector row is added.
- No always-on boundary gridlines through the traces — the hovered-slice band is the
  only boundary cue.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mini-sector-timing`: the ownership ribbon gains a positional requirement (it must
  occupy the identical x-range as the trace strips, so slice boundaries are
  pixel-aligned with the traces above), and the ownership readout is redefined as
  scrub-position-derived rather than per-slice hover.
- `lap-analysis`: the panel is four stacked strips rather than three, and the hover
  scrub requirement gains the cursor's extension through the ribbon plus the
  hovered-slice band across all strips.

## Impact

- `web/src/components/LapAnalysis.tsx` — `layoutStrips` gains a fourth strip,
  `renderTraces` draws the ribbon into the cached trace layer, `drawScrubOverlay`
  draws the band, the extended cursor and the sector caption, the JSX ribbon block
  and `hoveredSector` state are deleted, and the canvas wrapper's height classes grow.
- `web/src/lib/lapAnalysis.ts` — no change. `sectorOwners`, `SECTOR_COUNT` and the
  interpolation helpers are used exactly as they are today.
- No bridge, wire-format, or type-contract change. No new dependency.
- Render efficiency is preserved: ownership colors are keyed by the recordings
  version, so the ribbon belongs in the cached offscreen layer and a scrub frame stays
  a blit plus overlay.
