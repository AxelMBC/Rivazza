> **The working tree is not clean.** A previous attempt at this change is already applied to
> `web/src/{App.tsx,components/LapAnalysis.tsx,components/TrackMap.tsx,lib/lapAnalysis.ts}`. Group 0
> says exactly what to keep and what to undo. `bridge/src/parsers.ts` and `bridge/src/types.ts` also
> carry small **pre-existing comment edits that are not part of this change** — do not revert them.

## 0. Reconcile the previous attempt

- [x] 0.1 **Keep**: the braking-tick removal (`computeBrakeTicks`, `drawBrakeTicks`, `BrakeTick`, the
      `brakes` field, the `BRAKE_*` constants are already gone) — still required, now specified as a
      REMOVED requirement in `lap-line-comparison`.
- [x] 0.2 **Keep**: `slice: number` on `ScrubPoint` and `LapAnalysis`'s publishing of it; `latestComplete`
      in `lib/lapAnalysis.ts`; `recordingsRef`/`recordingsVersion` on `TrackMap`'s props.
- [x] 0.3 **Remove** from `lib/lapAnalysis.ts`: `SectorGate`, `sectorGates`, `sliceSampleRange`,
      `resolveGeometrySource`. All four exist only to put boundaries on a recorded lap's line.
- [x] 0.4 **Remove** from `TrackMap.tsx`: `drawSectorGates`, `drawScrubSlice`, `strokeNormalTick`
      (its last caller goes with the gates), `sectorGatesRef`, and the `SECTOR_GATE_*` /
      `SECTOR_SPAN_*` / `SECTOR_LABEL_*` / `INVALID_SPAN_ALPHA` constants. Keep `sectorOwnersRef` and
      the `syncSectorTables` ownership memo — group 4 reuses both. *(Also removed
      `TRACK_EDGE_WIDTH`, left dead by group 4: the edge width is now `SECTOR_EDGE_WIDTH` alone, one
      value, so the stroke never changes thickness between sectors — which would read as a render
      bug rather than as a division.)*

## 1. Normalized track position on the track edges — bridge

- [x] 1.1 In `bridge/src/aiSpline.ts`, compute cumulative chord length over the parsed spline points and
      normalize it: `pos[i] = cum[i] / total`, where `total` closes the loop (`cum[n-1] + |p[0] − p[n-1]|`)
      when `closed`, else `cum[n-1]`. Build it in the **same single pass** that fills `left`/`right`
      (`resolveTrackEdges`, ~`aiSpline.ts:141-156`), which is already strictly index-aligned with the
      spline points — verified: no point is dropped, inserted, resampled or reordered.
- [x] 1.2 Do **not** read the spline file's per-point `length` field. See `design.md` decision 1 — the
      geometric derivation is the fallback that field would need anyway, with nothing in front of it.
- [x] 1.3 Round `pos` to 5 decimals (≈5 cm on a 5 km lap), in the manner of the existing `roundCm`.
- [x] 1.4 Add `pos: number[]` to `TrackEdges` in **`bridge/src/types.ts` AND `web/src/types.ts`**. These
      are hand-mirrored; editing one compiles fine and breaks at runtime.

## 2. Verify the origin

> **Deviation from the plan, and the reason.** This group was written as a blocker on the
> rendering work. That was wrong: the check is "the S1 boundary lands on the start/finish line",
> which can only be *seen* once the division renders — circular. The rendering was written first.
> Nothing about that makes the fix harder: if the origin is offset, the correction is a constant
> applied where `pos` is produced (`aiSpline.ts`), and no rendering code changes.
>
> **What is now verified** (offline, against the real Imola spline, 3166 vertices): `pos` is
> monotonic, starts at exactly 0, and ends at 0.99967 — the last vertex sitting just short of the
> closing segment, as it should on a closed circuit. That validates the *derivation*. It says
> nothing about the *origin*, which remains the open question below.

- [ ] 2.1 `pos[0] = 0` assumes spline point 0 sits at the start/finish line, where
      `normalizedCarPosition` is zero. **This is an assumption, not a fact.** With the real game on a
      known track, log or plot the vertex where `pos` crosses 0 and confirm it lands on the start/finish
      line. Use the real game, not the mock — the mock's synthetic path is not guaranteed to follow the
      spline.
- [ ] 2.2 If it does not land there, the fix is a calibration offset applied where `pos` is produced
      in `aiSpline.ts` and carried in the same payload. Deliberately not designed in advance.

## 3. Eight sectors

- [x] 3.1 `SECTOR_COUNT: 24 → 8` in `web/src/lib/lapAnalysis.ts:16`, and rewrite the rationale comment
      above it (`:12-15`) — it currently argues for 24 on "a corner spans ~1–2 slices" grounds, which is
      no longer the reasoning.
- [x] 3.2 Confirm the count flows through without literals anywhere: `sliceAt`, the ribbon fill loop, the
      scrub band, `bestSectors`, `sectorOwners`, `theoreticalBestMs`. The sweep found no hardcoded 24
      outside the constant — check rather than assume.
- [x] 3.3 `SLICE_GAP` 1 → 2 px in `LapAnalysis.tsx`, and its comment rewritten — it referenced a DOM
      ribbon that no longer exists. At triple the slice width a hairline reads as a seam, not a
      boundary.

## 4. Draw the division on the edges

- [x] 4.1 `sectorVertexRuns(pos, count, closed)` at module scope, resolved once per `mapData` beside
      the existing static edge geometry. Adjacent runs share their boundary vertex so the strokes meet
      with no seam; on a closed circuit the last run wraps to vertex 0.
- [x] 4.2 Replace the two full-length `edgeLines` Path2Ds with 8 sub-paths per side (16 total), built
      once from those ranges with the existing `traceInto` helper.
- [x] 4.3 In `renderTrackLayer` (~`:566-606`), stroke each sub-path in its sector owner's identity color
      (`lapColor`) instead of the single `TRACK_EDGE` tone. Unowned → `TRACK_EDGE`. Invalid owner →
      subdued plus the critical tone, matching the ribbon's treatment. Widen the stroke from
      `TRACK_EDGE_WIDTH = 1` enough for a hue to register.
- [x] 4.4 Add an ownership fingerprint to `trackLayerKey` (`:561`, `:574-575`), which is currently keyed
      on `projKey` alone and has **no explicit reset** — it relies on the whole effect tearing down on
      `mapData`. Without this the edge colors would never update when a lap completes.
- [x] 4.5 `drawSectorLabel` renders `S<n> · L<lap>` (or `S<n>` when unowned) off the asphalt, anchored
      to whichever edge faces away from the track-bounds centre. *(The bounds loop that finds that
      centre already existed for the no-`map.ini` viewport but ran only in that case — extended to run
      whenever edges exist rather than adding a second pass over the polylines.)*

## 5. Scrub emphasis

- [x] 5.1 Add `drawScrubSector(project)`: from `scrubRef.current.slice`, re-stroke that sector's two edge
      sub-paths brighter and thicker on top of the blitted layer, and highlight its label. Two sub-paths
      per repaint, in the manner of `drawCutMarkers`.
- [x] 5.2 Keep the scrub ring, drawn after the emphasis so it stays on top.
- [x] 5.3 Confirm the map's rAF dirty-gate already covers every input this needs (`scrub`, `analysisLap`,
      projection, recordings version). Add no new wakeup source.

## 6. Demo mode

- [x] 6.1 Regenerated `web/public/demo/imola.map.json` (105 KB → 130 KB). *(No live bridge needed in
      the end: `resolveTrackAssets("imola", null)` reads the AC install directly, so a throwaway `tsx`
      script regenerates it offline — which is also what produced the validation data in group 2.)*
- [x] 6.2 Document that regeneration in `web/public/demo/README.md`, which currently covers only
      `imola.json`.

## 6b. Visual rework after the first look

Built and viewed: the owner's identity colour on the edge strokes is the same visual language as a
driving line, so the map became a thick multicolour band with neither edges nor laps distinguishable.

- [x] 6b.1 Track edges back to one neutral `TRACK_EDGE` tone at 1.25 px. No lap-identity colour on the
      track at all.
- [x] 6b.2 `LINE_WIDTH` 3 → 2, so laps overlapping through a corner stay individually readable.
- [x] 6b.3 Boundaries marked by short ticks growing **outward** from both edges — never onto the
      asphalt, and unambiguous about where the boundary falls in a way a colour change was not.
- [x] 6b.4 Ownership, invalidity and the identity hue move entirely into the label (`S3 · L5`,
      `S3 · L5 INV`, `S3` when unowned). Small enough to carry a saturated colour without competing.
- [x] 6b.5 Scrub emphasis re-toned: neutral-white edge brightening plus lengthened ticks, not a
      lap-coloured stroke.
- [x] 6b.8 Hover brightens the edge without thickening it — same width as everywhere else, opacity
      raised to carry the white on its own. A width change shifts where the track appears to end,
      which is the one thing an edge must not do. The boundary ticks still lengthen: they mark a
      sector, not a limit.
- [x] 6b.6 `outwardScreen` factored out — ticks and labels both need a world direction turned into a
      zoom-invariant screen offset.
- [x] 6b.7 `track-sector-division`, `track-limits`, `proposal.md` and `design.md` rewritten to match.
      The specs previously required the edge colouring that was just removed.

## 7. Verification

- [ ] 7.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas.
- [ ] 7.2 Confirm task 2.1 was actually done and passed. Everything below is meaningless if the origin
      is offset, because the map and the panel would disagree consistently and invisibly.
- [ ] 7.3 With `npm run mock -w bridge` and `npm run dev`, before completing any lap: confirm the track
      is already divided into 8 sectors — neutral thin edges, outward boundary ticks, labels `S1`–`S8`
      outside the asphalt — and that nothing is drawn across the track.
- [ ] 7.4 The regression this change exists to fix: complete two laps, then hover Lap 1's line, Lap 2's
      line, and nothing at all. **No boundary may move between the three states.**
- [ ] 7.5 Confirm labels name the owning lap in that lap's colour as laps land, while the edges stay
      neutral. Cross-check two or three sectors against the panel's ribbon readout — same owner, same
      sector number.
- [ ] 7.5b The reason for the rework: with two or three laps stored, confirm the individual driving
      lines can still be told apart from each other and from the track edge through a corner.
- [ ] 7.6 Scrub the analysis traces. Confirm the emphasized sector on the map tracks the panel's
      translucent band exactly, the ring rides within it, and both clear on pointer-out while the
      division stays.
- [ ] 7.7 Drive a lap with a cut. Confirm a sector owned by the invalidated lap reads `INV` in the
      critical tone in its label, and that the track edge is untouched by it.
- [ ] 7.8 Wheel-zoom and pan. Confirm each sector's edge run stays registered with the track edges, and
      judge the open question in `design.md`: does `S3 · L5` stay legible at fit zoom, or should the
      label shorten to `S3`? Record the answer in `design.md`.
- [ ] 7.9 Confirm the "Theoretical" readout still appears and is now slower than before — expected, and
      the reason is in `mini-sector-timing`. If it stopped appearing entirely, coverage is the suspect.
- [ ] 7.10 Load a track with no `fast_lane.ai` edges (or set `AC_PATH` to something without it) and
      confirm the map renders with no division, no labels and no error state.
- [ ] 7.11 Build the demo (`VITE_DEMO_MODE=1`) and confirm the regenerated blob divides the track.
