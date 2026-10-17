# Review: lap-files-audit-fixes

Snapshot: adeda23d82a23ad70377dcf5e1faf718e329e2c2

1. [rule] web/src/components/LapTimes/index.tsx:119 — `bestValidLapMs(laps)` runs twice per render: here for `LapListPanel` and again inside `displayedBestLapMs` (`LapTimes/bestLap.ts:21`), against design.md decision 4 ("computes it once"). · open
   Fix: compute `const bestValidMs = bestValidLapMs(laps)` once in `LapTimes`, pass it to `LapListPanel` and as a parameter to `displayedBestLapMs` instead of calling it there.
