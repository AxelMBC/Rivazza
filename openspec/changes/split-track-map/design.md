## Context

`TrackMap.tsx` grew one capability at a time, each landing as a new block of constants plus new
work inside the same `useEffect`. Nothing was ever wrong with an individual addition; the file is
simply the accumulated sum of seven of them. The structural facts that matter for the split:

- One long `useEffect` owns almost everything. It closes over the offscreen layers, the
  projection, the camera state, and the draw helpers, and returns the rAF teardown. Extraction
  has to preserve that single-owner lifetime — the layers "live only as long as this effect
  (mapData/session)".
- Cross-frame state lives in refs at component scope (`zoomRef`, `previousLapsRef`, `mouseRef`,
  camera refs) while per-effect state lives in closure variables (`currentLayerKey`,
  `appendedCount`, `lapsVersion`). The split must not silently promote a closure variable to a
  ref: that changes reset semantics on a session change.
- Rendering is dirty-gated. A frame repaints only when an identity comparison detects a change.
  Any extraction that allocates a fresh object per frame where the original reused one will
  un-gate the loop and burn CPU forever, invisibly.

## Goals / Non-Goals

**Goals**
- Each extracted module is understandable without reading the others.
- The orchestrating `TrackMap.tsx` reads as a sequence of named steps.
- Tuned constants travel with the code that reads them.

**Non-Goals**
- Behaviour change of any kind.
- Making the extracted modules "reusable" — they serve one component; cohesion is the goal, not
  generality.
- Converting closures to classes or introducing a state-management library.

## Decisions

**Extract pure geometry first, stateful machinery last.** `projection.ts`, `drivingLine.ts`, and
`markers.ts` are mostly pure functions of (samples, projection, ctx). They can move with high
confidence. `followCamera.ts` and `layers.ts` own mutable state and are where a regression would
actually hide, so they move last, individually, each verified before the next.

**Pass context explicitly rather than re-creating closures.** Extracted draw helpers take
`(ctx, project, …)` as parameters instead of closing over effect scope. This is what makes them
readable in isolation, and it forces the implicit dependencies the current closure hides to
become visible in signatures — the main review value of the whole change.

**Keep the projection key a single string.** Layer invalidation currently hinges on a composed
`projKey`. It is tempting to replace it with a structured object during the move; do not. The
string is the cheapest correct identity for the cache, and changing invalidation semantics in the
same change that moves the code makes any regression impossible to bisect.

**One commit per extracted module.** With no tests, `git bisect` over small commits is the only
real safety net. A single squashed refactor commit would be undiagnosable.

## Risks / Trade-offs

- **Silent render-efficiency regression.** The `render-efficiency` capability requires an idle map
  to perform zero repaints, and nothing surfaces a violation to the user except a warm laptop.
  *Mitigation:* instrument a temporary repaint counter during the change and assert it stays flat
  over ~10 idle seconds before and after each extraction step.
- **Reset-semantics drift.** Moving a closure variable into module scope would share it across
  sessions. *Mitigation:* every extracted stateful module gets an explicit factory called from
  inside the effect, so its state has exactly the effect's lifetime.
- **Follow-cam timing.** The camera depends on wall-clock `dt` and a delay buffer. Extraction that
  changes call order relative to `zoomed()` breaks framing subtly (a frame of lag, or an inert
  retarget). *Mitigation:* keep the `followCamera(base, …)` → `zoomed(base)` call order literally
  identical.

## Open Questions

- Should `legend.ts` own the React state push for DOM legend entries, or return entries for
  `TrackMap.tsx` to push? Leaning toward returning data and keeping all `setState` in the
  component, so only one module touches React.
- Is `projection.ts` one module or two (base projections vs. zoom composition)? Decide once the
  base projections are extracted and the real line count is visible.
