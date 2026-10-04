## Why

The track map records its driven line inside its dirty-gated rAF loop (`lines.ingest` in `TrackMap/index.tsx`), so recording only happens when the map repaints. The browser suspends rAF when the tab is hidden or the window is fully covered (Chrome's native occlusion tracking on Windows), which is the normal state of a dashboard sharing a monitor with a fullscreen game: the line for that stretch is never recorded and shows up as a gap or a straight chord. Even while visible, rAF only sees the newest frame per vsync, so frames that land two to a vsync are skipped and sample spacing at speed can double. The lap trace store already avoids both problems by recording per WebSocket message (`lap-telemetry-recording`); the map line never got the same treatment.

## What Changes

- The track map's line recorder ingests every telemetry frame as it arrives, through the existing `subscribeFrame` channel from `useTelemetry`, instead of inside the rAF repaint.
- The rAF loop only draws: a new frame still dirties the map and moves the dot, but recording no longer depends on a repaint happening.
- The current-lap layer cache detects a new lap by the identity of the current-lap sample array rather than by its length shrinking, so it stays correct when a whole lap or more is recorded between two repaints (map hidden for longer than a lap).

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- `render-efficiency`: the track map's line sampling is driven by message arrival and is independent of whether the map repaints; the full-rate scenario names the per-message channel instead of the rAF-read reference.

## Out of Scope

- Lowering the bridge's 60 Hz broadcast rate (explored and rejected: it costs brake-point resolution for negligible savings).
- Gating repaints on on-screen dot movement instead of on every new frame; this change makes it possible but does not do it.
- Merging the map's line recorder with the `useLapRecordings` store, which also carries `x`/`z`: the two differ in gating (1 m distance vs. monotonic `normalizedPos`), out-lap handling, jump flags and cut attachment.

## Impact

- `web/src/components/TrackMap/index.tsx`: new `subscribeFrame` prop and a component-level subscription that calls `lines.ingest`; the call is removed from the rAF tick.
- `web/src/components/TrackMap/layers.ts`: current-lap cache invalidation keyed on the sample array's identity.
- `web/src/App.tsx`: passes `subscribeFrame` to `TrackMap`.
- No wire-format, bridge or dependency change.
