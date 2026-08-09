## Context

The bridge detects cuts by polling AC's `numberOfTyresOut` and emitting an event on every
below-4 → ≥4 transition, re-arming as soon as a sample reads below 4 again
(`bridge/src/sharedMemory.ts`). The committed demo recording shows why that produces
clusters: on lap 3 (`lapCount=2`) the counter chattered across one continuous 2.04 s
excursion and fired three events 396 ms apart, all within 6 m of each other, plus one
genuine earlier excursion in the same lap — four × markers for a lap that died once.

The web app consumes those events in two places. `useTelemetry` accumulates them into
`cutsRef` (raw, session-scoped); `TrackMap` walks that list from its rAF loop and attaches
each event either to the in-progress lap (`currentCutsRef`) or, for a boundary straggler, to
the matching stored lap in `previousLapsRef`. `useLapHistory` consumes the same list
independently to flag lap validity.

Separately, `App.tsx` renders a single `WaitingScreen` whenever no session exists, with copy
that assumes a live bridge and a local copy of the game. A demo build — which has neither —
shows it while its 17.5 MB recording loads, and shows the "Waiting for Assetto Corsa" variant
if that load fails, since the demo path in `useTelemetry` sets status `waiting` on both the
fetch failure and the empty-recording case.

## Goals / Non-Goals

**Goals:**

- At most one × per lap, positioned where that lap was invalidated.
- The fix applies to live mode, demo replay, and recordings already committed.
- Demo builds never show copy a demo viewer cannot act on.
- No change to the wire format or the hand-mirrored `types.ts` pair.

**Non-Goals:**

- Detecting laps AC invalidates without raising `numberOfTyresOut` to 4. Researched and
  deliberately dropped: the UDP protocol exposes no lap-validity, cut, penalty, or
  tyres-out field in any of its three messages.
- Debouncing or otherwise changing what the bridge emits.
- Any change to how lap validity is decided.

## Decisions

### Enforce one-per-lap in the web app, at attach time

The alternative — suppressing repeat onsets in `sharedMemory.ts` by remembering the last
invalidated `lapCount` — is a smaller change and would quiet the bridge's log, but it cannot
fix what is already recorded. The demo recording committed at `web/public/demo/imola.json`
contains the four events verbatim, and demo replay is where the bug was reported from. A
bridge-side rule would leave that cluster on screen until the session were re-recorded.

Filtering where markers are attached fixes every input at once — live stream, demo replay,
and any future recording — and leaves `BridgeMessage`, `bridge/src/types.ts`, and
`web/src/types.ts` untouched, so the mirrored-type contract needs no attention.

The raw list in `cutsRef` stays complete. Only the map's attachment step filters, which keeps
`useLapHistory` correct without modification (it flags a lap invalid on any cut, and dropping
later duplicates does not change that) and leaves the full excursion history available should
a future change want it.

### Model "at most one" in the type, not by convention

`TrackMap` currently stores `cuts: CutMarker[]` per stored lap plus a `currentCutsRef` array.
Replacing both with a single nullable marker (`cut: CutMarker | null`,
`currentCutRef: CutMarker | null`) makes the invariant structural: there is no shape in which
a second marker can be attached, and the attach step becomes "write if empty". Keeping the
arrays and pushing conditionally would work identically but leaves an invariant that only
holds by discipline at one call site.

Both attachment sites are affected: the in-progress lap and the back-attach of a straggler
that arrives just after its lap rolled over. A straggler for a lap that already has its
marker is discarded, which is the correct reading — the lap died at the earlier cut.

Nothing outside `TrackMap` reads these fields, so the change is file-local. Lap rollover,
session reset, restart detection, and the bounded lap history keep their existing mechanics;
the marker simply travels with its lap as one value instead of an array.

### Reuse the existing status pair for the demo pre-session state

The demo path already distinguishes the two cases it needs: status stays `connecting` while
the recording is being fetched and parsed, and becomes `waiting` when the fetch fails or the
recording is empty. Rather than widen `ConnectionStatus` (which feeds `ConnectionBadge`'s
exhaustive style record, and would add a variant that can never occur in a live build), the
pre-session branch in `App.tsx` selects the screen by build flag first and status second:
demo builds render a loading screen or an unavailable screen, live builds render today's
`WaitingScreen` untouched.

This needs no change in `useTelemetry` at all. To keep the mapping legible rather than
implicit, the two demo screens are named for what they mean (loading / recording
unavailable), so the branch reads as intent rather than as a status lookup.

The spinner is CSS-only (`animate-spin` on a bordered element) using the existing semantic
tokens — no new dependency, and nothing that competes with the canvas rAF loops for frame
budget.

## Risks / Trade-offs

- **A lap with two genuinely separate off-tracks now shows only the first.** → Accepted by
  decision: the marker answers "where did this lap die", and a lap dies once. The dropped
  events remain in `cutsRef` if a later change wants a secondary treatment.
- **A discarded duplicate still bumps `cutSeq` and the cut-list length, so the map's
  dirty gate schedules one repaint that draws nothing new.** → Harmless and rare (a handful
  of events per session); the existing requirement that an idle map stays idle is unaffected,
  since an idle map receives no cut events at all.
- **Demo loading and demo failure are distinguished by a status value whose meaning is
  demo-specific.** → Contained to one branch in `App.tsx`; if the demo path later gains its
  own load state, the branch is the single place to update.
- **The `racer-dashboard` spec states the pre-session waiting screen is unchanged.** → That
  requirement describes the live dashboard; the new behavior is gated on the demo build flag,
  so the live path it refers to still holds exactly.
