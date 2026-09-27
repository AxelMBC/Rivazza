## Context

`TrackMap.tsx` has three layers of state:

1. **React state and refs at component level** (lines 283–411). The component holds:
   - about 25 `useRef`s: line samples, lap bookkeeping, zoom, nav, follow window and limits, the
     follow state and dwell timer, legend and hasFrame mirrors
   - the follow state machine and dwell handlers
   - `resetLines()`
2. **A map-data probe effect** (413–453). It fetches `meta` and `edges` from the bridge, or the
   static `DEMO_MAP_URL` file in demo mode.
3. **The render effect** (455–2340). This is one closure keyed on `mapData`. It creates four
   offscreen layer canvases, derives the edge geometry, and declares about 50 `let`s: layer keys,
   the `last*` dirty-gate mirrors, camera animation state, heading and trail buffers, inset
   dwell and touch-gesture state. About 60 inner functions read and write those `let`s
   freely. `draw()` runs the rAF loop. It also does data ingestion: restart detection, lap
   completion, sample appends and cut consumption all happen inside `draw()` before it paints.
   Event listeners for mouse, wheel, touch and click are attached at the bottom and removed in
   the cleanup.

Constraints that bind the split:

- `render-efficiency`: one dirty-gated rAF loop that only repaints when a rendered input changed,
  plus offscreen layers so a typical frame is a few blits.
- `CLAUDE.md`: the restart signature is duplicated in `useLapHistory`, `useLapDelta` and TrackMap,
  and the three copies must stay in sync.
- `code-style.md`:
  - arrow functions only, with no `<T,>` generics in `.tsx`
  - no section-banner comments
  - a type moves to its own module only when a second module needs it
  - a component gets its own folder when it grows helpers only it uses
- The branch is cut from `dev`, so it already carries `@rivazza/protocol`. I checked the
  master→dev diff for `web/`: it changes import specifiers only and doesn't alter TrackMap's
  structure.

## Goals / Non-Goals

**Goals:**

- `index.tsx` holds only wiring: props, refs, the one rAF loop, the one dirty gate, listener
  attachment, and the JSX. Every other job lives in a named module whose inputs are visible in its
  signature.
- Keep behaviour exactly the same, down to repaint cadence (see Risks).
- Each step lands on its own and can be checked against the mock before the next one starts.

**Non-Goals:**

- Behaviour changes, visual tweaks, and tuning any constant. Constants move with their comments,
  and their values stay as they are.
- De-duplicating the restart signature across `useLapHistory`, `useLapDelta` and TrackMap. It
  touches two hooks outside this component, and `CLAUDE.md` documents the triplication. That's a
  separate change.
- Splitting `LapAnalysis.tsx` (749 lines). It's the next candidate, but it's out of scope here.
- Reading canvas colours from the CSS `@theme` tokens. The "mirrors --color-accent" copies stay
  as they are.
- Moving `lib/touch.ts`. It holds browser synthetic-mouse constants for the `touch-interaction`
  capability, not TrackMap geometry, so it stays in `lib/`.

## Decisions

### D1. A component folder, not `lib/trackMap/`

`web/src/components/TrackMap/index.tsx` plus sibling modules. This follows the code-style folder
rule, and `App.tsx`'s import `./components/TrackMap` resolves to `index.tsx` with no edit.

`lib/` stays for helpers with more than one consumer (`lapAnalysis`, `lapColors`, `format`,
`interaction`, `demo`). `overviewInset.ts` has one consumer, so it moves into the folder.

*Rejected:* `lib/trackMap/`. That's where I put it during exploration, but it contradicts the
rule and would put component-private code next to shared helpers.

### D2. Keep one component, one rAF loop and one dirty gate

*Rejected:* splitting into child React components (a `<TrackCanvas>`, an `<InsetCanvas>`, a
`<FollowButton>` that owns follow state). Each canvas child would need its own rAF loop and its
own gate. Zoom, nav, follow and hover state is read by the camera, the inset, the hit test and the
gestures alike, so it would have to be lifted back up anyway. And the inset is a layer drawn into
the same canvas, not a separate element. That approach reads cleaner but fails `render-efficiency`.

The follow **button** stays in `index.tsx`'s JSX. Only its state logic moves into a hook (D5).

### D3. Module seam: factories that close over explicit state objects

Each canvas-side module exports a `create…` factory. The render effect calls the factory once and
passes in what the module needs: the context or layers, the refs it reads, and the **shared
mutable state objects** it writes. The factory returns the functions `draw()` calls. For example:

```
const geometry = buildTrackGeometry(mapData)                   // pure, once per effect
const layers   = createLayers({ canvas, ctx, geometry })       // owns the 4 offscreen canvases + keys
const camera   = createCamera({ zoomRef, followRef, navRef, followWindowRef, followLimitsRef, … })
const recorder = createLineRecorder({ currentRef, previousLapsRef, lapRef, lapTimeRef, boundsRef, … })
const gestures = attachGestures(canvas, { zoomRef, navRef, mouseRef, camera, frameState, … })
```

A factory keeps the current closure semantics almost line for line. The bodies move with their
closure variables, which become the factory's own `let`s. That makes it the lowest-drift way to
split roughly 1,900 lines with no tests behind them.

*Rejected:* pure functions over a single `RendererState` bag. It's more uniform, but every body
would have to be rewritten from `x` to `state.x`, which multiplies the chance of a silent behaviour
change. A single bag also recreates the "everything touches everything" problem, just with
property names.

*Rejected:* ES classes. The repo has none, and they buy nothing a closure doesn't already give.

**The one rule that makes it safe:** state read by more than one module goes in a small shared
object passed **by reference**: `frameState` (the per-frame `inset`, the current `project` and the
`firstDraw`/animation flags) plus the existing refs. A module never destructures a primitive from
it at factory time, or it would freeze a stale value. The dirty-gate mirrors (`last*`) stay as
`let`s in `index.tsx`, because only the gate reads them.

### D4. The dirty gate stays in one expression in `index.tsx`

The camera exposes its animating flags (`easing`, `followAnimating`, `navAnimating`) as
getters. The gate reads them next to its ref comparisons.

*Rejected:* each module reports its own `isDirty()`, and the gate ORs them. That spreads the
repaint rule `render-efficiency` specifies across nine files. One visible list is easier to check
against the spec, and easier to extend when a new input appears.

### D5. React-side logic becomes two hooks in the folder

- `useTrackMapData(session)` holds the probe effect, with its `async` generic `probe` moved into a
  `.ts` file (removing the `<T,>` hack). It returns `{ mapData, mapProbed }`.
- `useFollowControl(...)` holds `followRef`, `followUi` state, dwell timers,
  `startDwell`/`leaveDwell`/`onFollowActivate`, `retargetFollow` and `cancelDwell`, plus their
  unmount cleanup.

`resetLines()` stays in `index.tsx`. It resets refs owned by several modules and is the one place
where a session change or restart meets all of them, so it's wiring.

### D6. Ingestion is split from painting inside `draw()`, but still runs in the same tick

Restart detection, lap completion, sample appends and cut consumption move to `lineRecorder.ts`
as `recorder.ingest(frame, cutList)`. `draw()` calls it at the same point it runs today, after the
gate passes. It must not move to a separate listener or effect: today's repaint cadence depends on
ingestion only running on dirty frames.

The restart signature is moved as it is (see Non-Goals).

### D7. Target layout

```
components/TrackMap/
  index.tsx           component, refs, resetLines, render effect wiring, draw(), gate, JSX
  useTrackMapData.ts  meta/edges probe (bridge or DEMO_MAP_URL)
  useFollowControl.ts follow state machine + dwell
  constants.ts        sizing, timing, zoom and follow constants (with their tuning comments)
  palette.ts          canvas colours, pedal lerp + bucketed colour cache, legend swatch colours
  trackGeometry.ts    edges → fill/sector Path2Ds, sector anchors, edgeView/edgeCentre
  lineRecorder.ts     sampling, lap completion, restart, cut consumption, bounds
  layers.ts           offscreen track/laps/current/inset layers, keys, blit
  markers.ts          sector ticks and labels, cut ×, dot + heading, scrub ring and sector
  hitTest.ts          lap picking, hover readout, cursor
  camera.ts           fallback-view easing, follow camera, inset nav glide
  gestures.ts         mouse, wheel, touch, click, inset dwell; returns a detach function
  overviewInset.ts    moved from lib/ as is
```

Types that 2+ modules need (`Sample`, `View`, `Anchor`, `Project`, `Affine`, `FollowState`,
`CutMarker`) go in the module that produces them and are imported from there. There's no
`types.ts` catch-all. `Props` stays in `index.tsx`.

The file list is the target, not a contract. If a body turns out to belong elsewhere during
apply (for example the inset drawing fits better beside `overviewInset.ts` than in `layers.ts`),
move it and note it in `tasks.md`.

### D8. Step order: least risky first, a working tree after every step

1. Folder move and docs paths (a pure rename).
2. Constants and palette (pure data).
3. The two React hooks.
4. Geometry and recorder.
5. Layers, markers and hit test.
6. Camera.
7. Gestures (the most stateful, and shares the most with the camera).

After every step, typecheck and a mock smoke test, as tasks.md lists. That way a behaviour drift
can be traced to one step's diff.

## Risks / Trade-offs

- **[Stale capture]** A module destructures a value that `draw()` reassigns each frame (such as
  `inset`), and a gesture reads an old inset rect. → Shared per-frame values live on `frameState`
  and are read through it (D3). During apply, grep each new module for top-level destructuring of
  shared objects.
- **[Repaint cadence drift]** Moving ingestion or a gate term out of order changes when a frame
  repaints. That's invisible to types and only shows as extra CPU or a missed repaint. → The gate
  stays one expression in one file (D4), ingestion stays inside the gated branch (D6), and the
  manual check measures that an idle map stops repainting.
- **[Per-frame allocation]** Factories returning fresh objects every frame would add GC pressure
  at 60 Hz. → Factories run once per effect. `draw()` passes existing objects and allocates only
  what it allocates today.
- **[Listener order]** Gestures attach in a different order, or the cleanup misses one, which
  leaks listeners across `mapData` changes. → `attachGestures` returns one detach function, and
  the effect cleanup calls it along with `cancelAnimationFrame`.
- **[Review size]** Roughly 2,400 moved lines are hard to review. → Each D8 step is one reviewable
  diff. Moved bodies keep their text, so `git diff --color-moved` shows them as moves.
- **[Blame loss]** → `git blame -C -C` follows moved blocks. Noted in the proposal's Impact.
- **[No tests]** Type checking proves the modules connect, nothing more. → The manual list in
  tasks.md §10 covers every capability the file spans, and a smoke subset runs after each step.

## Migration Plan

This is a pure refactor with no data migration, flags or deploy steps. To roll back, revert the
branch. Every step leaves a working tree, so a partial apply can also stop after any step.

## Open Questions

None blocking. Whether the inset drawing sits in `layers.ts` or next to `overviewInset.ts` is
decided during apply (D7).
