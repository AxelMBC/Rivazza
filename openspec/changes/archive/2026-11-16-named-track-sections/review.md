# Review: named-track-sections

Snapshot: a1662fb0808ecdc99a951a4669aa94eab6c2bd11

1. [defect] web/src/components/LapAnalysis/scrubOverlay.ts:60 — the owner readout is right-aligned with no left limit, so a long section name (`International Pits Straight · Lap 12 · 12.345 inv`, ~245 px by the auditor's estimate) overprints the `SECTORS` caption on a plot narrower than ~315 px; section names have no length cap, so a longer mod-track name reaches it on wider panels · fixed
   Fix: in `drawScrubOverlay`, measure the `SECTORS` caption and, when `readoutX` would fall left of its end plus a gap, shorten the name with an ellipsis until it fits (the lap and time must survive).
2. [duplicate] web/src/lib/sectorDivision.ts:40 — `sectorIndexAt` repeats the bisect loop of `bracket` in web/src/lib/lapAnalysis.ts:38 · fixed
   Fix: export one `lowerIndex(length, valueAt, pos)` from `lapAnalysis.ts`; `bracket` keeps its range guard and calls it, and `sectorIndexAt` calls it over `division.bounds`.

## Spec-level note (not a code finding)

`0 ≤ IN < OUT ≤ 1` drops sections that wrap the start line, and stock content has them: `ks_laguna_seca` (`Turn 1`, 0.988 → 0.048) and all four `ks_highlands` layouts (`Start/finish`). Those corners get no sector of their own. The code does what the spec says; design decision 1 did not consider a section that itself wraps.
