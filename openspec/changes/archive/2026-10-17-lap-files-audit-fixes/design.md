## Context

`useLapRecordings` stores a lap's recording on the raw frame stream. `useLapHistory` gives that lap its status in an effect on the ~30 Hz throttled state, so for at least one render a recording exists without a `LapRecord`. `lib/lapAnalysis.ts` filters with a blacklist (`status !== "valid"`), so that unjudged recording counts as valid. The same split clock explains the dropped cut: the bridge stamps a cut with its newest UDP lap, and the throttled `telemetry` can still be on the previous lap.

## Goals / Non-Goals

**Goals:** close both defects at the shared helpers, and leave one copy of each duplicated rule and markup.

**Non-Goals:** changing what is judged, the frame budgets' values, or the panels' layout.

## Decisions

### 1. Allow-list valid laps in `lib/lapAnalysis.ts`

`resolveReference` and `bestSectors` take `validLapSet(laps)` (status `valid`) and skip every recording not in it. `sectorOwners` skips a recording with no `LapRecord`, and still lets invalid laps own a sector with `invalid: true` as today. That fixes the eviction pin, the analysis panel and the track map's sector owners (`TrackMap/markers.ts`) together. `LapTimes`' `judgedLaps` filter becomes redundant and is deleted. The alternative, filtering out unjudged recordings at each call site, is the workaround that already drifted.

### 2. Cut cursor waits for the lap state

In `useLapHistory`'s cut loop, a cut with `cut.lapCount > telemetry.lapCount` stops the loop without advancing `consumedCutsRef`. It is matched on a later run, once the state reaches that lap. `framesWaited` increments only when `telemetry` is a different object from the last run's, tracked with a ref. A `cutSeq` re-run with the same frame doesn't spend the budget.

### 3. Selected analysis lap as an object

`selectedLap` state holds a `LapRecording | null`. `selected = sel && reviewableLaps.includes(sel) ? sel : latest`. A restart or eviction creates or drops objects, so a stale selection falls back to `latest` without an effect. `LapChips`' `onSelect` passes the recording.

### 4. Shared pieces and where they live

- `bestValidLapMs(laps)` lives in `lib/lapStatus.ts`. `LapTimes` computes it once and passes it to `LapListPanel`.
- `formatDelta(ms)` moves to `lib/format.ts` and returns the sign (U+2212 or `+`) plus seconds to two places. The delta tile shows it as is. The scrub readout wraps it as `Δ …s`.
- `LapStatusChip` (`status`, optional `className` for the spacing that differs per caller) is built on `lapStatusTag` and renders nothing for valid/unknown. It lives at `web/src/components/LapStatusChip.tsx` because three features use it, and features don't import from each other. `TimeTile`'s hard-coded `inv` span becomes `<LapStatusChip status="invalid" />`. `LapLegend` keeps showing it only for pit laps.
- `isLastLapFresh(frame, pending, maxFrames)` lives in `lib/lapTransition.ts`, beside `classifyLapTransition`. Each hook keeps its own budget constant: 3 throttled frames vs 6 raw frames, both about 100 ms. They count different streams, so they stay separate values.
- `coversLap(samples)` sits in `lib/lapAnalysis.ts` beside the coverage constants. It replaces the two full-span checks in `useLapRecordings`. `sectorTimes` checks each end separately, so it keeps its own two checks.

### 5. `RevealPanel` shares the panel, not the opening logic

`web/src/components/RevealPanel.tsx` renders the `absolute bottom-full … group-hover:opacity-100` wrapper from an `open` prop and children. Each caller keeps its own opening logic. `LapAnalysis` must hold `open` in state on mouse hover, because `analysisLapRef` feeds the map. `LapTimes` toggles only on immediate activation, on the whole tile group, and clears `hoveredLapRef` on close. A shared `useReveal` hook would need options for both differences, and that costs more than it saves.

### 6. `LapTimes/` folder

`index.tsx` holds the wiring: `LapTimes`, `TimeTile` and `liveDeltaMs`. `LapListPanel.tsx` holds the session lap list. `bestLap.ts` holds the pure validity-aware best-lap rule (`displayedBestLapMs(telemetry, laps, settled)`), which is the `gameBest`/`gameBestNotValid` logic now inline. The import in `App.tsx` stays `./components/LapTimes`.

## Risks / Trade-offs

- The delta tile's minus changes from ASCII `-` to U+2212. It's slightly wider in some fonts, and the tile uses tabular numerals. → Covered by the visual check.
- A cut stamped with a lap that never arrives (session change) would block the cursor. → A session change or a clear replaces `cutsRef`'s array, and that resets the cursor. A restart sets the cursor to the end.

## Open Questions

- none
