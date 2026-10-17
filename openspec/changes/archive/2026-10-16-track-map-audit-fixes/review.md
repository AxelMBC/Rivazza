# Review: track-map-audit-fixes

Snapshot: 3736fa2840e6722895d739f1b6b14e8e1920d336

1. [duplicate] web/src/components/TrackMap/palette.ts:10 — `READOUT_BG` / `READOUT_BORDER` repeat the raw values of the lap-analysis scrub readout (LapAnalysis/scrubOverlay.ts:123, :126), whose box drawing (roundRect, fill, 1 px stroke, segmented fillText) is near-identical to hitTest.ts's · open
   Fix: move the two colours to a shared module under web/src/lib/ used by hitTest.ts and scrubOverlay.ts; optionally a shared `drawReadoutBox` helper
