## Why

`web/src/components/TrackMap.tsx` is 2,000+ lines — roughly a third of all web source in one
file. It absorbs seven separate capabilities (`track-map-viewport`, `track-map-zoom`,
`track-map-follow-cam`, `driving-line-gradient`, `cut-markers`, `car-heading-marker`,
`track-limits`), and it carries far more explanatory comment volume than any other file in the
repo — not because the code is unusually subtle, but because no module boundary, filename, or
import list is doing any of the explaining.

This is the file the new readability conventions in `CLAUDE.md` point at directly: *a file
spanning more than two capabilities gets split.* It was deliberately deferred out of the
repo-wide style pass because, unlike a comment sweep or an import reorder, it is a real
behavioural risk: the canvas code depends on dirty-gated rAF loops, offscreen layer caches keyed
on a projection string, and append-only geometry buffers. There is no test suite to catch a
regression.

## What Changes

- `TrackMap.tsx` becomes a folder, `components/TrackMap/`, with the orchestration component and
  its JSX staying in `TrackMap.tsx` and the cohesive concerns extracted to sibling modules.
- **No behaviour changes.** Every rendered pixel, gate, and interaction stays as-is. This is a
  pure structural refactor; if any behaviour changes, that is a bug in the change.
- Comments that exist only to announce which concern the reader is currently in are replaced by
  the module boundary and filename. Comments encoding external constraints or tuned-constant
  rationale move with their code.
- Extracted modules are plain functions and constants wherever possible, so the pieces can be
  reasoned about (and eventually exercised) without mounting a canvas.

Proposed seams, taken from the existing constant blocks and layer effects:

```
components/TrackMap/
├── TrackMap.tsx          orchestration, refs, effect wiring, JSX
├── projection.ts         fit / map.ini / edge-bounds projections, world↔screen, zoom composition
├── followCamera.ts       dwell arming, follow state machine, delay buffer, easing
├── layers.ts             offscreen layer cache, sizing, projection-key invalidation
├── drivingLine.ts        pedal color buckets, Path2D batching, current-lap tail
├── markers.ts            cut ×, brake ticks, car heading wedge, scrub/hover rings
└── legend.ts             hover picking, readout rows, legend entries
```

## Capabilities

No capability changes. This is a refactor: the seven capabilities listed above keep their
current requirements and scenarios verbatim. No delta specs are included, and
`openspec/specs/` is untouched.

## Impact

- **Web**: `components/TrackMap.tsx` → `components/TrackMap/`. The import in `App.tsx` resolves
  unchanged if the folder exposes `TrackMap.tsx` and the import path is updated to
  `./components/TrackMap/TrackMap`.
- **Risk**: high relative to the rest of the readability work, and unguarded by tests. The
  render-efficiency invariants are the most fragile part — `render-efficiency` requires that an
  idle map performs no repaints, which is easy to break by accident when moving state between
  modules.
- **Verification**: the `verify` skill (mock bridge + dev servers + headless browser) is the
  only end-to-end check available. A before/after canvas comparison at matched telemetry
  positions is the strongest available signal.
- No dependency, wire-format, or bridge changes.

## Non-goals

- Changing any rendering, interaction, or camera behaviour.
- Introducing a test framework (the repo has none; adding one is its own decision).
- Splitting `LapAnalysis.tsx` (600 lines, one capability) — it does not meet the rule's bar.
