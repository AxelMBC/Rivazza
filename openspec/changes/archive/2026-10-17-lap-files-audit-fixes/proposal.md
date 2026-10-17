## Why

The audit of the lap files found two defects: a lap without a verdict yet counts as valid, and a cut stamped just after the line is dropped. It also found duplicated rules and a `LapTimes.tsx` that spans too many jobs. Fixing them in one change avoids editing `LapTimes.tsx` twice, once for the fix and again for the split.

## What Changes

- Only laps the lap log marked `valid` qualify as reference, best sector, sector owner or pinned best. Today any lap that isn't marked otherwise counts, including the newest recording before its verdict lands. `LapTimes`' local `judgedLaps` workaround goes away.
- A cut event stamped with a lap the throttled lap state hasn't reached yet waits for it instead of being dropped. The pending-lap frame budget counts only new telemetry frames, not effect re-runs caused by cut events.
- `LapAnalysis` remembers the selected recording object instead of its lap number, so the reset effect is gone.
- `useTelemetry`'s `BridgeMessage` switch gets a `never` default.
- One `bestValidLapMs`, one `LapStatusChip`, one `formatDelta` replace the copies. The delta tile and the scrub readout now share the same minus sign (U+2212).
- Structure: `isLastLapFresh` shared by both lap hooks, `coversLap` beside the coverage constants, `LapTimes/` split into a folder, and one `RevealPanel` for the two hover/click popovers.

## Capabilities

### New Capabilities

### Modified Capabilities

- `lap-history`: Heuristic lap invalidity gains the cut-just-after-the-line scenario. Validity-aware best-lap display gains the not-yet-judged scenario.
- `lap-telemetry-recording`: Bounded memory with best-lap pinning gains the eviction-before-verdict scenario.

## Out of Scope

- Any change to how laps are judged, the frame budgets' values, or what the panels show apart from the minus sign.
- A shared opening hook for the two popovers: their open logic differs (see design.md).
- A lint rule for exhaustive switches.

## Impact

`web/src/lib/{lapAnalysis,lapStatus,lapTransition,format}.ts`, `web/src/hooks/{useLapHistory,useLapRecordings,useTelemetry}.ts`, `web/src/components/LapTimes.tsx` → `web/src/components/LapTimes/`, `web/src/components/LapAnalysis/{index.tsx,LapChips.tsx,scrubOverlay.ts}`, `web/src/components/TrackMap/LapLegend.tsx`, new `web/src/components/{LapStatusChip,RevealPanel}.tsx`. No wire, bridge or dependency changes.
