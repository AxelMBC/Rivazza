## Context

`TrackMap/index.tsx` is the wiring module of the map: props, refs, the factories, one rAF loop with one dirty gate,
and the JSX. The 2026-09-27 split left three non-wiring jobs behind (see the proposal). The repo's oxlint config
enables `react/only-export-components` (`web/.oxlintrc.json`), so a `.tsx` file may export only components and
constants.

## Goals / Non-Goals

**Goals:** `index.tsx` holds wiring only. The gate's inputs are listed once.

**Non-Goals:** any change in behaviour, styling, repaint cadence or the shape of the factories.

## Decisions

### 1. Legend state stays in `index.tsx`; building it moves to `legend.ts`

The legend is React state written from the rAF loop (`setLegend` when the key changes). The loop decides when to
sync, so `legend` and `legendKeyRef` stay in `index.tsx`. `legend.ts` exports the `LegendEntry` type,
`legendEntries(previousLaps, laps)` (the last `COLORED_LAPS` stored laps, newest first, joined with their
`LapRecord`) and `legendKey(entries)`. `syncLegend` in `index.tsx` becomes those two calls plus the compare.

Rejected: the builder inside `LapLegend.tsx`. `only-export-components` would warn on the non-component export.
Rejected: `LapLegend` owning its own state fed by a subscription. It would add a second channel next to the refs,
which `CLAUDE.md` rules out ("the pieces communicate only through refs").

### 2. `FollowButton` owns its visibility rule

`FollowButton` takes `followUi`, `dwelling`, `hasFrame` and `follow`, and renders the whole bottom-left container
including the `(followUi === "off" ? hasFrame : followUi !== "exiting")` rule. The title strings, the `CLICK_MODE`
branches, the touch `preventDefault` and the dwell bar move unchanged.

### 3. `PedalKey` renders the three swatches from one list

`PedalKey` maps over `[["Throttle", THROTTLE], ["Coast", COAST], ["Brake", BRAKE]]` with the same markup and order.
The "No map file" notice stays in `index.tsx`, because it reads `mapProbed`/`mapData`.

### 4. The gate compares a tuple

```ts
let lastInputs: readonly unknown[] | null = null;
// in draw():
const inputs = [nav, followState, followWindow, frame, mouse, zoom, cutList, cutList.length,
                hoveredLap, scrub, analysisLap, recVersion, width, height, dpr];
const dirty = lastInputs === null || fallbackEasing || followAnimating() || navAnimating() ||
              inputs.some((v, i) => v !== lastInputs[i]);
if (!dirty) return;
lastInputs = inputs;
```

`lastInputs === null` replaces `firstDraw`. The motion flags (`fallbackEasing`, `followAnimating()`,
`navAnimating()`) stay as separate terms because they are "still moving", not compared values. Comparison stays `!==`,
as today. The named locals (`frame`, `width`, …) remain because the rest of `draw()` uses them.
`syncSectorTables()` keeps running once per dirty frame, before drawing.

Rejected: keeping the 15 mirrors. The comparison and the reassignment are two lists that must stay in step by hand.
Rejected: a generic `createDirtyGate` helper in another module. `CLAUDE.md` wants the gate as one expression in
`index.tsx`.

## Risks / Trade-offs

- A term dropped or reordered in the tuple → the map freezes on that input or repaints at rest. Mitigation: the
  tuple lists exactly the 15 values the current gate compares (`index.tsx:340-354`), and the manual checks cover
  idle, hover, zoom, follow, scrub and resize.
- One array allocation per animation frame (~60/s, 15 slots). Negligible next to the paint it gates.

## Open Questions

None.
