## Context

`LapAnalysis.tsx` filters its lap list to valid complete recordings, and `sectorClass` colors the
24-slice strip by comparing the selected lap's sector times against `bestSectors` (valid-only).
Two dead branches already anticipate this change: the chip renders `record?.invalid` times in
`text-critical` (unreachable, since invalid laps are filtered out), and `sectorClass` guards on
`selectedValid` (unreachable for the same reason).

The validity signal is `LapRecord.invalid` from `useLapHistory` — heuristic (would-be-PB the game
did not adopt, pit touch) with shared-memory cut events as the authoritative override. It can land
in the lap log a few frames *after* the recording is stored, which is why `bestSectors` is
deliberately recomputed on every render rather than memoized on the recordings version. Any new
derivation reading `invalid` inherits that constraint.

Interaction is hover-only in live builds (`CLICK_MODE` is false; a click steals focus from the
game). The demo build flips to click mode via `isImmediateActivation` / `HOVER_GROUP_CLASS`.

## Goals / Non-Goals

**Goals:**

- Make every complete lap reviewable, with invalidity unmistakable wherever it appears.
- Turn the sector strip into a session-wide ownership ribbon that surfaces sectors won on laps
  that did not count.
- Keep every "target" number — reference, session best, theoretical best — valid-only.
- Preserve the panel's dirty-gated canvas rendering and hover-only interaction.

**Non-Goals:**

- Changing how validity is determined (`useLapHistory` is untouched).
- Changing sector count, sector derivation (`sectorTimes`), or the recordings store.
- Keeping a per-lap sector comparison anywhere in the panel — the tri-tone presentation is
  removed, not relocated.
- Bridge, wire-contract, or track-map changes: the map already consumes `analysisLapRef`.

## Decisions

### Two tables, one derivation pass

`bestSectors(recordings, laps, count)` stays exactly as it is (valid-only, feeds
`theoreticalBestMs`). A sibling `sectorOwners(recordings, laps, count)` returns, per slice,
`{ lap, timeMs, invalid } | null` computed across **all** complete recordings.

```
recordings[] ─┬─► bestSectors()   valid only ──► theoreticalBestMs()  ──► "Theoretical 1:23.465"
              └─► sectorOwners()  all laps   ──► ribbon color + hover readout
```

*Alternative rejected:* one table carrying both the overall owner and the valid best. It reads
smaller but couples two numbers with different rules, and the next reader has to keep straight
which field is safe to sum. Two named functions with one-line doc-free signatures are clearer, and
both are a few hundred interpolations — negligible at the 30 Hz render rate.

Both are called unmemoized at render, for the frame-lag reason above.

### Ribbon color and the invalid tone

Slice color: `lapColor(owner.lap)` when valid, the `critical` token when invalid, an inert
`bg-hairline` when unowned. Red is unambiguous here because `LAP_PALETTE` deliberately avoids
red/green/yellow — an invalid-owned slice can never be confused with an identity color.

*Alternative rejected:* a hatch or outline for the invalid case instead of solid red. It preserves
the owner's identity color but is illegible at strip scale and needs a legend to decode.

### Strip height and readout

The strip grows from `h-1.5` to a height where 24 distinct hues are separable (target ~`h-3`,
tuned against the panel's `max-h-[42vh]`). Because `lapColor` wraps every 5 laps, hovering a slice
shows a small readout — `S7 · Lap 9 · 3.412` with an `INV` marker when the owner is invalid —
implemented in DOM with `onMouseEnter`/`onMouseLeave` per slice plus the `isImmediateActivation`
touch path, mirroring the chip rows. The strip is DOM, not canvas, so this needs no rAF work and
no change to the dirty-gate.

### Invalid-selection cues, and what stays identity-colored

An invalid lap is marked in three places: its chip (an `INV` tag beside the lap number, its time
already in `text-critical`), the panel header (`Lap 5 (INV) vs Lap 4 (ref)` with the critical
tone), and — transitively — the map's cut markers once selected.

The selected lap's **speed trace keeps its identity color** rather than turning red. Red is
already load-bearing inside the canvas as the brake trace and the losing-time delta; a red speed
line would collide with both. Invalidity is a property of the lap, not of a value being plotted,
so it belongs on the chrome around the traces, not in them.

### The no-reference state

Newly reachable: a selected lap with `reference === null` (every complete lap cut). The canvas
already guards this (`showRef`, `deltas = []`) and draws a bare dashed zero line, which reads as
broken. The delta strip's right-hand caption — today `±6.1s` — becomes `no valid reference` in the
caption tone when `ref === null`, and the `DELTA TO REFERENCE` label stays put. This is one
`fillText` branch inside `renderTraces`, already inside the layer key that includes `ref?.lap ?? -1`,
so the dirty-gate needs no change.

### Selection lifecycle

`reviewableLaps` becomes every `r.complete` recording; the `invalidLaps` set is no longer used to
filter it (only to mark). The existing sticky-selection effect already falls back to follow-latest
when a selection's recording disappears, and its condition (`r.complete && r.lap === selectedLap`)
is unchanged — but the previous behavior where *invalidation* silently reset the selection is gone
by design: an invalid lap now stays selected.

Bar summary: the lap count reports `reviewableLaps.length` (now including invalid), while
`sessionBestMs` stays derived from `laps.filter(l => !l.invalid)`. The "no valid laps yet" branch
of the bar disappears — with invalid laps listed, a session with complete recordings always has
something to review.

## Risks / Trade-offs

- **Per-lap sector feedback is lost.** The ribbon no longer says how the selected lap did in each
  slice. → The delta strip sits directly above it, aligned on the same x-axis, and answers the
  question continuously rather than in 24 buckets. Accepted deliberately (option A over a
  two-row layout that the panel's height budget cannot afford).
- **Ownership flips on tiny margins.** A 2 ms improvement recolors a slice, so the ribbon can
  churn late in a session. → Deterministic strict-minimum with a stable tie-break; this is how
  timing screens behave and the churn is information, not noise.
- **Palette collisions.** Laps 4 and 9 share a color, so the ribbon alone cannot identify an owner
  past 5 laps. → The hover readout is the resolution, which is why it is a spec requirement and
  not a nicety.
- **Red overload.** `critical` now carries invalid laps, invalid-owned slices, brake input, and
  lost time. → Each lives in a distinct surface (chip / ribbon / pedal strip / delta strip) and the
  speed trace decision above keeps them from meeting.
- **Landing on a cut lap by default.** After every mistake the panel jumps to the invalid lap and
  the delta strip turns red. → Intended: that lap is the one the driver just drove, and selecting
  it is what reveals the cut markers on the map.
- **Validity frame lag.** A lap can appear valid for a few frames before the cut lands, briefly
  coloring a slice with an identity color instead of red. → Self-correcting on the next render
  because both tables are recomputed unmemoized; do not "optimize" either into a version-keyed
  memo.

## Migration Plan

Pure front-end change, no persisted state, no wire-format change — deploying is a rebuild and
rolling back is a revert. Verifiable end-to-end without the game via `npm run mock -w bridge`
plus the `verify` skill's headless-browser driving; the mock's periodic fake excursions produce
the invalid laps the new paths need.

## Open Questions

- Exact ribbon height and readout placement (inline caption beside `SECTORS` vs. a floating chip)
  are best settled against the running mock rather than on paper.
