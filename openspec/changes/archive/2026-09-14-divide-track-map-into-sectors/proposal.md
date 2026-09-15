## Why

The driver can see which lap was fastest overall, and the analysis panel's ribbon says which lap owns
each mini-sector — but the ribbon is an abstract strip. Nothing on the track map says where a sector
*is*, so "Lap 5 owns S12" never becomes "Lap 5 was quicker through Acque Minerali". Analysis stops at
the lap.

A first attempt marked the boundaries with short ticks struck across each lap's **driven line**. That
was wrong three ways, and running it proved it:

- It marked the racing line — one driver's path through the circuit — when a sector is a property of
  the **track**.
- It was visually identical to the braking-point ticks already drawn there, which move from lap to lap
  while sector boundaries do not. The fixed division read as though it drifted between laps.
- Lines struck across the track obstruct the very racing line the map exists to show.

The geometry to do it properly is already in the repo and being discarded. `bridge/src/aiSpline.ts`
parses AC's `ai/fast_lane.ai` — the same spline AC measures `normalizedCarPosition` against — into the
left/right track-edge polylines that draw the asphalt ribbon, one edge vertex per spline point. What
is missing is only each vertex's position along the lap, which is a cumulative sum away from data the
parser already holds. That turns a sector from a mark on a driven line into a **span of real track
between two edges**.

## What Changes

- **The mini-sector count drops from 24 to 8.** 24 slices cannot be named or told apart on a map (on
  Imola they are ~204 m each); 8 are ~614 m, which reads at a glance and is the granularity a driver
  actually reasons about. `SECTOR_COUNT` is one shared constant, so the analysis panel's ribbon
  becomes 8 slices too, and the two surfaces finally describe the same thing.
- **`TrackEdges` gains a per-vertex normalized track position**, derived on the bridge as cumulative
  chord length over the spline's own points and index-aligned with the existing `left`/`right` arrays.
  **This is a wire change: both hand-mirrored `types.ts` files and the `/api/track-map/edges`
  payload**, and it stales the demo build's static asset, which must be regenerated.
- **Sector geometry comes from the track, not from a recorded lap.** The division therefore exists
  from the moment the track loads — before a single lap is driven — and is identical for every lap by
  construction, because it is not derived from any lap.
- **The division is marked outward of the track, not across it and not on it.** Each boundary gets a
  short tick growing away from the asphalt on both edges. Nothing is struck across the track, so the
  racing line stays unobstructed — the constraint that killed the first attempt.
- **The track edges stay neutral and thin, and the driving lines get thinner too.** Painting
  lap-identity hues onto the edges was tried and is wrong: a saturated color there is the same visual
  language as a driving line, so at the width a hue needs to register the edges read as two more laps
  and the real ones become impossible to pick out. The map's only saturated colors are a lap's own
  line and the small sector labels.
- **Each sector is labelled `S1 · L5` outside the track edge**, offset away from the circuit along
  the cross-track direction, so no label sits on asphalt. The owning lap is named in text and colored
  in that lap's identity hue — text because the palette is shorter than the sector count, so color
  alone could not name an owner unambiguously in any case.
- **A sector with no owner is labelled with its number alone**; a sector owned by an invalidated lap
  is named invalid in the critical tone, so a time the driver did not keep is never presented as a
  clean best. Both cues live in the label, never in the track edge.
- **While scrubbing a lap in the analysis panel, the hovered sector is emphasized on the map** — its
  edges brighten to a neutral white, its boundary ticks lengthen and its label highlights — answering
  "which sector am I looking at in this lap" directly on the track. The existing scrub ring still marks the exact point within it.
- **The racing-line gate machinery is removed** (`sectorGates`, `drawSectorGates`, the
  `SECTOR_GATE_*` constants, `strokeNormalTick`, `resolveGeometrySource`), superseded by the above.
- **The braking-point ticks stay removed.** They are the marks that were mistaken for sectors, they
  move per lap, and the pedal strip plus the lines' own pedal gradient already carry braking points.

## Capabilities

### New Capabilities

- `track-sector-division`: the track divided into a fixed number of sectors as a property of the
  circuit — boundary positions resolved on the track's own edge geometry, the always-visible outward
  boundary ticks, the sector labels that name the owning lap, the invalid cue, the scrub emphasis, and
  the degraded states (no edge data, no completed lap yet).

### Modified Capabilities

- `mini-sector-timing`: the count becomes 8 and is no longer described as "on the order of 24"; the
  sector split is defined by normalized track position independently of any recording, so slice times
  and the ownership table are computed against a division that exists before the first lap.
- `track-limits`: the edge polylines gain a per-vertex normalized track position; the edge strokes
  stay one neutral tone and get thinner, with sector boundaries marked outward of them.
- `track-asset-resolution`: the `/api/track-map/edges` payload gains the position array.
- `lap-analysis`: the scrub channel publishes the hovered sector alongside the scrub point so the map
  can emphasize it; the ribbon renders 8 slices.
- `lap-line-comparison`: the braking-point marker requirement is **removed**.

## Impact

- `bridge/src/aiSpline.ts` — accumulate chord length in the existing edge loop; emit `pos` per vertex.
- `bridge/src/types.ts` **and** `web/src/types.ts` — `TrackEdges` gains the position array. These are
  hand-mirrored; editing one and not the other compiles and breaks at runtime.
- `web/src/lib/lapAnalysis.ts` — `SECTOR_COUNT` 24 → 8; delete the recording-derived gate helpers.
- `web/public/demo/imola.map.json` — regenerated for the new payload shape, and the regeneration
  documented in the demo README, which covered only the telemetry recording.
- `web/src/components/TrackMap.tsx` — boundary ticks and labels in the cached track layer, the scrub
  emphasis on top; removal of the gate drawing; `LINE_WIDTH` and the track-edge width both reduced so
  overlapping laps stay distinguishable.
- `web/src/components/LapAnalysis.tsx` — unchanged apart from following `SECTOR_COUNT`.
- **Visible side effect the driver will notice:** the panel's "Theoretical" best will get slower.
  It sums the best time in each sector, and 8 large sectors offer less opportunity to splice the best
  of every lap than 24 small ones. The current number is optimistic; the new one is more honest.
- **Risk carried into design:** position is measured from the spline's point 0. That this coincides
  with the start/finish line — the origin of `normalizedCarPosition` — is assumed, not verified. If it
  does not, every sector on the map is offset against the panel's, silently. Checked against the real
  game; the correction, if needed, is a constant where `pos` is produced and touches no rendering.
