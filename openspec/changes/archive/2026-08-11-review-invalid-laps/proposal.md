## Why

An invalidated lap is currently invisible to the analysis panel — it is not listed, not
selectable, and cannot own a sector. But a cut lap is often the most instructive lap of a
session: it is where the driver went faster, and where they went off. Hiding it removes the
evidence exactly when it is most wanted. Meanwhile the mini-sector strip answers a question
the delta trace already answers ("how did this lap compare?") instead of the one nothing
answers ("which lap owns each part of the track?").

## What Changes

**Invalid laps become reviewable.**

- The analysis lap list includes every complete recorded lap, valid or not. **BREAKING** —
  reverses the standing directive that an invalidated lap never appears as a chip.
- An invalid lap in the list and as the panel's selection is marked red (an `INV` tag beside
  its number, its time and the panel header in the critical tone), matching the session lap
  list's existing cue.
- Default selection follows the most recent complete lap **including** an invalid one, so the
  panel lands on "what I just did" rather than skipping past the mistake.
- The reference lap, the session best, and the theoretical best remain strictly valid-only.
  An invalid lap is reviewable; it is never a target.
- New reachable state: a lap is selected while no reference exists at all (every complete lap
  cut). The delta strip must state why it is empty instead of rendering a bare zero line.
- The panel's empty state moves from "no reviewable laps" to "no complete recordings" — with
  invalid laps listed, an all-cut session now has something to show.
- The collapsed bar's lap count describes the full list; its session best stays valid-only.
- No new wiring needed for the payoff: `analysisLapRef` already drives the track map, so
  selecting an invalid lap reveals that lap's line and its red cut markers — the map answers
  "why was this lap invalid".

**The mini-sector strip becomes a sector-ownership ribbon.**

- Each slice is colored with the lap-identity color of the lap holding the fastest time for
  that slice across the session, instead of by how the selected lap compares to the best.
  **BREAKING** — the strip becomes selection-independent and the best/matched/slower tri-tone
  presentation is removed, not supplemented.
- A slice whose fastest raw time belongs to an invalid lap renders in the critical (red) tone:
  *you went faster here, but it did not count*.
- Two tables now exist where one did: an **ownership** table (all complete laps, drives strip
  color) and the existing **valid-only bests** table (unchanged, drives the theoretical best).
  The theoretical best stays a time the driver could actually have driven.
- The strip gains a hover readout naming the owning lap and its sector time, and enough height
  to read as a mosaic — the lap palette wraps every 5 laps, so color alone cannot identify an
  owner in a long session.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lap-analysis`: the lap selection list admits invalid laps and marks them red; the default
  selection follows the latest complete lap regardless of validity; the panel's empty state and
  the no-reference delta strip get explicit definitions. Reference and session best stay
  valid-only.
- `mini-sector-timing`: the best-sector comparison presentation is replaced by sector ownership
  coloring with a red invalid-owner case and a hover readout; a separate ownership table is
  introduced while the theoretical best remains valid-only.

## Impact

- `web/src/components/LapAnalysis.tsx` — lap list filter, invalid-selection cues, empty states,
  no-reference delta caption, sector strip rendering and its hover readout.
- `web/src/lib/lapAnalysis.ts` — new sector-ownership derivation alongside `bestSectors`;
  `bestSectors` and `theoreticalBestMs` unchanged in behavior.
- `web/src/lib/lapColors.ts` — an explicit invalid-owner color constant if the critical token's
  canvas/CSS equivalent is not already available to the strip.
- No bridge changes; no wire-contract changes; no new dependencies.
- Hover-only interaction rule applies throughout: every new affordance (chip selection, sector
  readout) must work on hover alone in live builds, with the demo build's click mode honored via
  the existing `interaction` helpers.
