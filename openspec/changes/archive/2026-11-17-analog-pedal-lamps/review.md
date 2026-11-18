# Review: analog-pedal-lamps

Snapshot: fbaf60846ca40f2d316858b70544a14a36fb9953

1. [duplicate] web/src/components/InstrumentCluster/PedalLamp.tsx:1 — `PEDAL_ON_THRESHOLD` (0.05) is the same pedal dead zone as `DEAD_ZONE` in `TrackMap/constants.ts:16` (used by `palette.ts:49,51`) and the bare `0.05` in `LapAnalysis/scrubOverlay.ts:105,110`; the spec ties the lamps to the driving-line convention but nothing keeps the three in step. Pre-existing copy, moved by this change. · open
   Fix: in a separate change, one `PEDAL_DEAD_ZONE` in `web/src/lib/` (e.g. `lib/pedals.ts`) imported by `palette.ts`, `scrubOverlay.ts` and `PedalLamp.tsx` — in `lib`, since InstrumentCluster importing TrackMap's constants would make one feature import another.
