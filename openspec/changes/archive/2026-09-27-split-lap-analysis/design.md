## Context

`LapAnalysis.tsx` (749 lines) is the hover-revealed panel above the collapsed "Lap analysis" bar.
It has three regions:

| Lines | What |
| --- | --- |
| 1–92 | imports, `Props`, 20 layout and colour constants, `layoutStrips`, `sliceAt`, `ownersKey` |
| 93–160 | selection state, `open`, derived laps, the eviction and `analysisLapRef` effects, mirror refs |
| 161–607 | one effect: trace layer, scrub overlay, dirty-gated rAF loop, mouse and touch scrub |
| 609–749 | session-best derivation and JSX (header, lap chips, canvas, collapsed bar) |

Inside the effect, all jobs share two closure `let`s (`rafId`, `mousePos`), the dirty-gate
`last…` set and `layerKey`. The only coupling between jobs is `mousePos`, written by input and read
by the gate and the overlay. The trace layer and the overlay otherwise read only their arguments
and the mirror refs.

`TrackMap/` (archived `split-track-map`) is the precedent. Its conventions apply here unchanged:
`index.tsx` is wiring, it owns one rAF loop and one dirty-gate expression, per-effect jobs are
`create…`/`attach…` factories called with the refs they read, and modules communicate only through
refs, never through a primitive captured at creation.

## Goals / Non-Goals

**Goals:**

- `index.tsx` reads as wiring: state, derived values, one effect that builds the pieces and runs
  the gated loop, and the panel JSX. Target is under ~300 lines.
- Each module owns one job and can be read without the others.
- Identical pixels, identical gate terms, identical `scrubRef`/`analysisLapRef` contract with
  `TrackMap`.

**Non-Goals:**

- Moving anything out of `web/src/lib/lapAnalysis.ts`. It is shared with `TrackMap` and
  `useLapRecordings`.
- Sharing the pedal colours with `TrackMap/palette.ts`. They are equal values in different forms
  (CSS strings here, `Rgb` tuples there), and a cross-component palette is its own change.
- Memoising the per-render sector tables. The comment at the call site explains why they are
  derived every render; it moves with them.
- Any visual, timing or interaction change.

## Decisions

### D1. Target layout

```
web/src/components/LapAnalysis/
  index.tsx        component, state, derived laps, effects, the rAF loop + dirty gate, panel JSX
  constants.ts     PAD_*/STRIP_GAP/RIBBON_H/SLICE_GAP, colours, Strip, layoutStrips, sliceAt,
                   plotX, ownersKey
  traceLayer.ts    createTraceLayer(canvas) → { layer, render(sel, ref, owners, w, h, dpr) } | null
  scrubOverlay.ts  drawScrubOverlay(ctx, pos, sel, ref, owners, w, h)
  scrubInput.ts    attachScrub(canvas, { scrubPosRef, selectedRef, scrubRef }) → detach
  LapChips.tsx     the reviewable-lap chip row
```

`App.tsx` keeps `import { LapAnalysis } from "./components/LapAnalysis"`, since the folder's
`index.tsx` resolves to the same specifier.

*Alternative:* two files (`LapAnalysis.tsx` + `lapAnalysisCanvas.ts`). Rejected, because it leaves
a 450-line canvas module that still mixes three jobs, and it breaks the folder shape `TrackMap/`
just established.

### D2. `plotX` becomes a pure module function

Today it is an effect-local arrow over `PAD_X`. It uses nothing from the closure, so it moves to
`constants.ts` as `plotX(pos, width)` next to `layoutStrips`. The trace layer, the overlay and the
scrub input all need it (input needs the inverse), so a single home avoids three copies.

### D3. `mousePos` becomes `scrubPosRef`

It is the one piece of state two jobs share, so by the `TrackMap/` rule it becomes a ref. It is a
component-level `useRef<number | null>(null)`. `attachScrub` writes it, and the gate and
`drawScrubOverlay` read it. Being a `useRef`, it is a stable dependency for oxlint's
exhaustive-deps, so the effect's dependencies stay `[scrubRef]` plus stable refs.

### D4. The trace layer is a factory; the overlay is a plain function

`createTraceLayer` owns state (the offscreen canvas and its context), so it is a factory returning
`null` when `getContext` fails, which preserves today's early `return`. `drawScrubOverlay` owns
none: it paints onto the visible `ctx` from its arguments, so it is a function, not a factory. The
`layerKey` cache check stays in `index.tsx` next to the gate. Deciding *whether* to rebuild is
gating, and gating lives in one place.

### D5. Selection logic stays in `index.tsx`, not a hook

`selectedLap`, `open`, the eviction effect and the `analysisLapRef` effect are ~40 lines and are
read by the JSX directly. A `useLapSelection` hook would add a hop without removing a job from the
reader's path. Revisit it if the panel gains a second selection source.

### D6. `LapChips` takes plain props

`LapChips` receives `reviewableLaps`, `laps`, `selected`, `reference` and `onSelect`. It reads no
refs and owns no state, so hover-select (`onMouseEnter`) and touch-select (`onPointerUp` with
`pointerType === "touch"`) move verbatim. The header and collapsed bar stay in `index.tsx`: they
are short and share `sessionBestMs` with nothing else.

### D7. Step order: least risky first, a working tree after every step

1. Folder move (pure rename), then check that the app loads.
2. `constants.ts`.
3. `LapChips.tsx`.
4. `scrubOverlay.ts`.
5. `traceLayer.ts`.
6. `scrubInput.ts` + `scrubPosRef`.
7. Docs.

Each step ends with `npx tsc -b web --noEmit` and `npm run lint -w web`, so a break is found at
the step that caused it.

## Risks / Trade-offs

- **[Two contexts mixed up]** The trace layer draws on `traceCtx`, the overlay on the visible
  `ctx`. A moved body that references the wrong one still type-checks. → Each module receives
  exactly one context and has no access to the other.
- **[`scrubRef` left dangling on unmount]** Today's effect cleanup sets `scrubRef.current = null`
  after removing listeners, so the track map stops echoing the point. → Cleanup order stays in
  `index.tsx`: `cancelAnimationFrame`, `detachScrub()`, then clear `scrubRef`.
- **[Gate term dropped]** The gate has nine terms. Losing `ownersKey` would leave stale ribbon
  colours when a lap is invalidated after its recording is stored (the case the `ownersKey`
  comment documents). → The gate expression moves nowhere, and it is compared term by term against
  the baseline in the verification tasks.
- **[Idle repaint regression]** Invisible to `tsc`. → Measure the paint rate at idle with the
  panel open, before and after.

## Migration Plan

Refactor only, with no data or wire changes. Rollback is reverting the commit.

## Open Questions

- Should the pedal colours become a shared `lib/` palette used by both `TrackMap` and
  `LapAnalysis`? That is out of scope here (see Non-Goals) and worth a `/opsx:tweak` afterwards
  if you want it.
