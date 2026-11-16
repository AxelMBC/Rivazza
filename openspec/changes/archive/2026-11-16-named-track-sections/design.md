## Context

`SECTOR_COUNT = 8` (`web/src/lib/lapAnalysis.ts:19`) is imported by the analysis panel (`constants.ts`, `traceLayer.ts`, `scrubOverlay.ts`, `index.tsx`) and the track map (`trackGeometry.ts`, `markers.ts`). Every consumer turns a slice index into a position with `i / SECTOR_COUNT`, and `sectorTimes`, `bestSectors` and `sectorOwners` take a `count`. The comment above the constant says AC's track assets carry no corner metadata. That is wrong: `data/sections.ini` does.

What the file looks like in the installed game:

- `ks_nordschleife/nordschleife/data/sections.ini`: 39 `[SECTION_n]` blocks, each with `IN`, `OUT` (normalized position) and `TEXT`. UTF-8 **with a byte-order mark**, CRLF. Names carry umlauts (`Döttinger Höhe`) and trailing spaces (`Schwalbenschwanz `).
- The sections are corners, not a partition. On the Nordschleife neighbours are separated by small gaps (`Flugplatz` ends 0.148, `Schwedenkreuz` starts 0.161); on Imola the gaps are whole straights (first section starts at 0.123).
- All four Nordschleife layouts have one, as do Imola and Magione (the mock's track). Mod tracks often don't.

## Goals / Non-Goals

**Goals:** one sector division per session, named where the track names its sections; every existing sector surface (ribbon, band, readout, map ticks, labels, emphasis) follows it with no second source of truth; tracks without the file behave exactly as today.

**Non-Goals:** any new analysis built on the names (time-loss ranking, spoken deltas); using a section's own `IN`/`OUT` span for corner metrics; a protocol version bump.

## Decisions

### 1. Boundaries at the midpoint of each gap, first sector from 0, last to 1

The division needs to tile the lap, because sector times are differences of interpolated lap time at boundaries and the ribbon has no notion of a hole. With sections sorted by `IN`, the boundary between sector *i* and *i+1* is `(out[i] + in[i+1]) / 2`; boundary 0 is 0 and the last is 1. Each sector is "the corner plus half the track on either side of it".

Beat **gaps as their own unnamed slices**: on the Nordschleife that adds ~38 slivers a few dozen metres long, which doubles the label count for stretches nobody names. Also beat **wrapping the first/last gap across the start line**: a sector spanning the line would need a time stitched from two laps, and `sectorTimes` works within one recording.

The bridge guarantees the input (sorted by `IN`, each `OUT` greater than the one before, at least two sections), which makes the midpoints strictly increasing and strictly inside (0, 1) — the web derivation needs no second validation pass beyond tolerating a missing field.

### 2. The bridge sends the raw sections; the web derives the division

`SessionInfo` gains `sections?: TrackSection[] | null` with `TrackSection = { name: string; in: number; out: number }`. The derivation lives in a new pure module, `web/src/lib/sectorDivision.ts`, unit-tested with `node:test`.

Beat **sending derived boundaries**: the raw `in`/`out` spans are what a later corner analysis needs (out of scope here, but it would otherwise mean a second wire change), and the tiling rule is a display decision that belongs with its consumers.

The field is optional so that the committed demo recording and any older bridge stay valid; the bridge always sends it (`null` when unavailable), and the web reads `session.sections ?? null`. By the rule beside `PROTOCOL_VERSION`, an additive field older peers can ignore needs no bump.

### 3. One `SectorDivision` value, derived once in `App.tsx`

```ts
type SectorDivision = { bounds: readonly number[]; names: readonly string[] | null };
```

`bounds` has one more entry than there are sectors. `App.tsx` derives it with `useMemo` keyed on the session and passes it to `LapAnalysis` and `TrackMap`. `sectorTimes`, `bestSectors` and `sectorOwners` take `bounds` in place of `count`; `sliceIndexAt` becomes a binary search over `bounds`; every `i / SECTOR_COUNT` becomes `bounds[i]`. A `sectorLabel(division, i)` helper in the same module returns the name or `S{i+1}`, so the panel readout and the map label cannot spell a sector differently.

Beat **each component deriving it from `session`**: two derivations is exactly what the "single shared value" requirement forbids. `TrackMap` reads it as an effect-level input like `edges` — it changes only when the session does, which already re-runs the render effect, so it is not a new term in the dirty gate.

### 4. Theoretical best stays on the eight equal slices

`LapAnalysis/index.tsx` keeps calling `bestSectors` with the equal division's bounds (`equalDivision(SECTOR_COUNT)`), independent of the session's division. The spec already argues that fine slices flatter the driver; 39 sections on a 7-minute lap would do just that. `SECTOR_COUNT` survives as the fallback count and the theoretical-best basis, and stops being imported by anything that draws.

Beat **summing the named sectors**: a visibly lower number, but one the spec calls out as misleading. Beat **grouping names into coarse blocks**: needs a grouping rule nobody has asked for.

### 5. Map labels are culled greedily when the layer is built

39 labels do not fit around the Nordschleife at full fit. When `layers.ts` rebuilds the track-surface layer (projection or ownership change — already its only triggers), labels are placed longest sector first and any whose box intersects one already placed is skipped. Ticks are always drawn. The scrubbed sector's label is drawn per repaint by `markers.ts` as today, so a culled sector still names itself while scrubbed.

Beat **abbreviating names** (ambiguous) and **numbers at full fit, names when zoomed** (two label vocabularies, and a threshold to tune).

### 6. Parser in its own module, decoded defensively

`bridge/src/content/sectionsIni.ts` takes a `Buffer` and returns `TrackSection[] | null`, so it is unit-testable without a game install; `trackAssets.ts` only finds the file and calls it. Decoding: strip a BOM, try `TextDecoder("utf-8", { fatal: true })`, fall back to `windows-1252` (mod tracks are often saved in the system code page). The first existing file among the layout-aware candidates is the only one tried, mirroring the edges rule for the same reason.

`resolveTrackAssets` currently returns `null` when neither `meta` nor `edges` resolved; sections are independent, so it returns whatever it has, keeping the existing "no map data" warning.

## Risks / Trade-offs

- A straight's time is split between the corner before and the corner after it → accepted; the sector that loses time under braking is still the one named after the corner being braked for.
- The narrowest Nordschleife sector (`T13`, ~0.5% of the lap) is a few pixels of ribbon on a narrow panel → the seam is drawn inside the slice and clamped so it never eats it (spec scenario covers it).
- A mod `sections.ini` with nonsense positions passes validation and produces odd sectors → the division is still a valid tiling; the worst case is unhelpful names, never a crash or a wrong lap time.
- The demo build shows no names until the Imola recording is re-made → out of scope, called out in the proposal.
- `useLapRecordings`' sample cap (`MIN_POS_STEP = 1/12000`) gives ~60 samples across the shortest Nordschleife sector → enough for interpolated boundary times.

## Open Questions

- none
