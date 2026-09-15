## Context

`bridge/src/aiSpline.ts` already parses AC's `ai/fast_lane.ai` into the left/right edge polylines that
`TrackMap` draws as the asphalt ribbon. Three properties of that code decide this design, and all
three were read rather than assumed:

- **Edge vertices are index-aligned with spline points.** `resolveTrackEdges` builds `left[i]` and
  `right[i]` inside one `for (let i = 0; i < n; i++)` loop over the parsed points
  (`aiSpline.ts:130-157`). Nothing is dropped, inserted, resampled or reordered. Edge vertex *i* **is**
  spline point *i*.
- **That spline is the curve AC measures `normalizedCarPosition` against.** It is not an
  approximation of the track's centerline; it is the same object.
- **The asphalt is thin on screen.** At fit zoom on Imola the ribbon is ~14 px wide with the driving
  lines on top, so a per-sector *fill* tint would be mostly covered — and, as decision 4 records after
  seeing it run, so is anything else that tries to carry color on the track itself.

The panel side needs nothing new: `sectorTimes`, `bestSectors` and `sectorOwners` in
`web/src/lib/lapAnalysis.ts` already answer "which lap was fastest in each sector". What is missing is
where a sector *is*.

## Goals / Non-Goals

**Goals:**

- The track is divided into 8 sectors, visible from the moment the track loads, identical for every
  lap because it is derived from the track rather than from any lap.
- Which lap owns each sector is readable on the map **without hovering anything**.
- Scrubbing a lap in the analysis panel shows which sector is under the cursor, on the track.
- The racing line is never obstructed.

**Non-Goals:**

- Marks struck across the asphalt. This is the constraint that killed the first attempt and it is
  binding, not a preference.
- Per-sector delta coloring ("where did *I* lose time"). A different question from "who was fastest
  here", and not what was asked for. The data is there if it is ever wanted.
- Renaming the `mini-sector-timing` capability. "Mini" is a poor fit at 8, but the id is referenced
  across the archive and churning it buys nothing.
- Restoring the braking-point ticks.

## Decisions

### 1. Derive normalized position geometrically — do not read `length` from the file

The AI point record is `{ float x, y, z, length; int32 id }` and `length` is AC's cumulative distance
along the spline. The obvious move is to recover it (the parser currently reads `x` at `p` and `z` at
`p+8` and skips `length` at `p+12`).

**Rejected.** The same number is already recoverable from data the parser has and has already
sanity-checked: cumulative chord length over the parsed `x`/`z` points. At AC's spline density the
chord sum tracks arc length to well under the sample spacing, and it costs one pass over an array that
is already in memory.

Reading `length` instead would add a fourth trusted field to a file the module's own header comment
describes as routinely garbage — it would need its own monotonicity and finiteness checks, and a
geometric fallback anyway for when they fail. Deriving geometrically *is* that fallback, with nothing
in front of it.

```
cum[0] = 0
cum[i] = cum[i-1] + |p[i] - p[i-1]|
total  = closed ? cum[n-1] + |p[0] - p[n-1]| : cum[n-1]
pos[i] = cum[i] / total
```

`TrackEdges` gains `pos: number[]`, index-aligned with `left`/`right`, rounded to 5 decimals (5 cm on a
5 km lap) in the manner of the existing `roundCm`. **Both `types.ts` files and the
`/api/track-map/edges` payload change**, and the payload shape is normative in
`track-asset-resolution`.

*Alternative rejected:* derive `pos` on the **web** from the edge polylines it already has, which would
need no wire change and no demo regeneration. The only curve available there is the midpoint of
`left[i]`/`right[i]`, and that is not the spline: the spline sits at `mid + dz·(sideRight − sideLeft)/2`,
laterally offset wherever the track is not symmetric about the AI line. Cumulative length along an
offset curve differs from the spline's by roughly `offset × total turning` — about 0.4 % of a lap for a
3 m average offset on a closed circuit, which is ~20 m of drift, ~3 % of a sector. Since the entire
point is that the map and the panel divide the lap *identically*, a systematic few-percent disagreement
is exactly the defect being fixed. The bridge has the real spline points; it does it exactly.

**Demo mode pays for this.** `web/public/demo/imola.map.json` is a static `{meta, edges}` blob served in
place of the two endpoints (`web/src/lib/demo.ts`), and its `edges` has no `pos`. It must be
regenerated from a live bridge, or the demo build shows an undivided track. The demo README documents
regenerating `imola.json` but not this file — the regeneration command goes in `tasks.md` and the
README.

### 2. The origin is an assumption, and it is checked before any rendering is written

`pos[0] = 0` assumes spline point 0 sits at the start/finish line, because that is where
`normalizedCarPosition` is zero. AC's convention is that the AI line begins there, but this is not
verified and a mismatch would offset every sector on the map against the panel's ribbon — silently.

The check is one glance: **the S1 boundary must be drawn at the start/finish line**, against the real
game rather than the mock (the mock's synthetic path is not guaranteed to follow the spline). It was
first written as a blocker on the rendering work, which was wrong — the boundary can only be *seen*
once the division renders, so the ordering was circular. What can be checked without rendering, and
was, is the derivation itself: on the real Imola spline `pos` is monotonic over 3166 vertices, starts
at exactly 0 and ends at 0.99967, one closing segment short of the lap.

If it fails, the fix is a calibration constant resolved on the bridge by matching the spline to a
known reference, added to the same payload — designed only if needed, not speculatively.

### 3. Eight sectors, from one shared constant

`SECTOR_COUNT: 24 → 8` in `web/src/lib/lapAnalysis.ts`. It already feeds the ribbon, the ownership
table, the theoretical best and the scrub band, so the panel and the map divide the lap identically
with no second source of truth.

Consequence, accepted and stated in the proposal: the theoretical best gets slower, because splicing
the best of every lap across 8 large sectors recovers less than across 24 small ones. The present
number is optimistic; this one is more honest.

### 4. The division is marked outward; the track carries no sector color at all

**Revised after seeing it run.** This decision first put the owner's identity color on each sector's
run of edge strokes, widened enough for a hue to register. Built and viewed, it fails plainly: a
saturated color on the edge is the same visual language as a driving line, so the track became a
thick multicolored band in which neither the edges nor the laps could be picked out. The asphalt is
~14 px at fit zoom — there is no room for two color systems.

So the track itself carries no sector color:

- **Boundaries** are short ticks growing *outward* from both edges, never onto the asphalt, in a
  neutral tone. Outward because the racing line is what the map is for, and because a mark across the
  line is indistinguishable from a braking or cut marker — the exact confusion that sank the first
  attempt.
- **Edges** stay one neutral `TRACK_EDGE` tone, and thin.
- **Ownership and invalidity** move entirely into the label (decision 5), which is small enough to
  carry a saturated hue without competing.
- **`LINE_WIDTH` drops 3 → 2.** Several laps overlap through a corner; at 3 px they merged into one
  band regardless of what the edges did.

*Alternatives rejected:* tinting each sector's asphalt polygon (too little uncovered asphalt for a
low-alpha tint to read, and raising the alpha competes with the pedal gradient); alternating neutral
tones per sector to imply a rhythm (a value step is ambiguous about exactly where a boundary falls,
which a tick states outright).

### 5. The label is the only place ownership appears

`S3 · L5` placed off the asphalt at each sector's midpoint, offset along the cross-track direction
(`right[i] - left[i]`), choosing whichever side points **away from the track's bounding-box centre** so
all eight labels land outside the circuit rather than some in the infield. Text in the owning lap's
identity color; `S3 · L5 INV` in the critical tone when that lap was invalidated; `S3` alone when no
lap owns it.

The lap number is in the label deliberately. `LAP_PALETTE` has 5 colors and `lapColor` is
`palette[lap % 5]`, so with 8 sectors two owners can share a hue — color alone cannot name the owner
anywhere, on the edges or otherwise. Naming the lap in text is what makes "which lap was fastest in
which sector" readable at a glance, which is the whole request, and it confines the identity palette
to a few characters instead of spreading it over the length of the circuit.

### 6. Rendering goes in the cached track layer, keyed on ownership


`trackLayer` is an offscreen canvas keyed on `projKey` (projection only) and `track-limits` requires it
stay that way for the ribbon. The boundary ticks and labels go in that layer and `trackLayerKey` gains
an ownership fingerprint, so the layer rebuilds when a lap completes or is invalidated — a handful of
times per session — and a scrub frame stays a blit.

The 8 sector vertex ranges are resolved once per edges payload (a single pass over `pos`) and cached
alongside the existing static edge geometry.

### 7. Scrub emphasis is the only thing drawn per repaint, and the driven-line span is dropped

While scrubbing, the hovered sector's two edge runs re-stroke brighter and thicker on top of the
blitted layer, and its label highlights. Two sub-paths per repaint, in the manner of the cut markers.

The scrub ring stays — it marks the exact point within the sector. The owner-colored stroke along the
selected lap's driven line, built in the previous attempt, is **dropped**: with the sector now
delimited on the track itself it restates what the edges already say, and it puts a mark back on the
racing line. `sliceSampleRange` loses its only caller and goes with it.

`ScrubPoint` keeps the `slice` field — the panel remains the single place a pointer position resolves
to a sector, so the panel's band and the map's emphasis cannot disagree.

## Risks / Trade-offs

- **The origin assumption (decision 2).** → Blocking first task, checked against the real game.
- **A track with no `fast_lane.ai` edges gets no division at all.** Those tracks already have no
  asphalt ribbon, so there is no surface to divide. → Accepted and specified: the map renders exactly
  as it does today, with no placeholder.
- **Eight labels could still crowd a tight circuit.** → They sit outside the track and are only eight;
  if it reads badly the honest lever is dropping the `· L5` half, not moving them onto asphalt. Manual
  check.
- **Palette reuse means two labels can share a hue.** → The lap number is in the text, so the hue is
  decoration rather than the identifier.
- **Neutral edges make ownership less scannable than color would.** Accepted deliberately: color on
  the track was tried and cost more than it bought. → The labels answer the question, and the panel's
  ribbon still carries the full-color ownership view.
- **The layer rebuilds on every completed lap.** It rebuilds the ribbon path too, which is the
  expensive part. → Once per lap is well inside budget; the alternative (stroking 16 long paths every
  repaint) is not.
- **Working tree carries the previous attempt.** The brake-tick removal and `ScrubPoint.slice` are kept;
  the gate machinery is removed. `tasks.md` states which is which rather than assuming a clean tree.

## Open Questions

- Does `S3 · L5` stay legible at fit zoom, or does the label need to shorten to `S3`? Settled by
  looking at it; carried as a manual check.
