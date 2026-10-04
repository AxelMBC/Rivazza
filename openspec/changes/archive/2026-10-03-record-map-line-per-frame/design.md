## Context

`TrackMap/index.tsx` runs one dirty-gated rAF loop. When the gate trips, the tick calls `lines.ingest(frame, cutList, resetLines)` with `telemetryRef.current` before drawing. `ingest` (`lineRecorder.ts`) does three jobs: restart and lap-rollover detection, cut attachment, and appending a sample once the car has moved more than `SAMPLE_SPACING` (1 m). So recording happens only when the map repaints, and it only sees the newest frame at each repaint.

`useTelemetry` already exposes `subscribeFrame`, which calls listeners synchronously for every telemetry message (live and demo replay). `useLapRecordings` uses it for the same reason this change needs it (`lap-telemetry-recording`: "not a rAF loop subject to background-tab throttling").

`layers.ts` caches the current lap's stroked segments. It detects a new lap only when `samples.length - TIP_HOLDBACK` drops below the count it has already cached. That only works because today nothing can be recorded between two repaints.

## Goals / Non-Goals

**Goals:** the recorded line depends only on the frames received, never on repaint timing; the cached drawing stays correct however much was recorded between repaints.

**Non-Goals:** changing what is sampled (1 m gate, jump flag, caps); changing the repaint gate; unifying the recorder with `useLapRecordings`.

## Decisions

### 1. Ingest from a `subscribeFrame` listener at component level

`TrackMap` takes `subscribeFrame` as a prop. A component-level effect subscribes `frame => lines.ingest(frame, cutsRef.current, resetLines)`. `lines` comes from `useState`, `resetLines` is a `useCallback` over stable objects, and `cutsRef` is a ref, so the subscription is made once and outlives the render effect, which re-runs when map data arrives. That matches how `TrackMap` already keeps state that must survive that effect. The tick drops its `ingest` call and keeps `frame !== lastFrame` in the gate, so a new frame still repaints the dot.

**Alternative considered:** keep ingesting in the tick but drain a queue of frames buffered since the last repaint. This still couples recording to the tick, adds a buffer that grows without bound while hidden, and duplicates what `subscribeFrame` already provides.

### 2. Current-lap cache keyed on the sample array's identity

`lineRecorder` replaces `currentRef.current` with a new array on every rollover and reset. `layers.ts` remembers the array it cached from and clears `currentPaths`, `currentPathCount` and `appendedCount` when that array changes. It no longer relies on the length shrinking, which misses a rollover once the new lap is already longer than the cached one. The stored-laps layer is already keyed on `lapsVersion()`, which counts every rollover, so it needs no change.

### 3. Cuts attach on the next frame

Cut attachment stays inside `ingest`. Today a cut message that arrives between frames attaches on the repaint it triggers. Now it attaches when the next telemetry frame is ingested, at most one frame interval later. While driving, frames keep arriving, so the marker appears no later than it visibly would. The `cutList` terms stay in the repaint gate.

## Risks / Trade-offs

- `resetLines` can now run from a WebSocket callback and calls `setFollow("off")`, which sets React state. That is legal outside render and happens at most once per restart.
- The 1 m distance check now runs on every message instead of every repaint: one `Math.hypot` at 60 Hz, which costs nothing measurable.
- While hidden, the drawing falls behind the samples. On the first repaint after, the current-lap layer strokes every new segment at once (up to a few thousand in incremental mode). That is a single frame, the same work as today's full re-stroke after a zoom change.

## Open Questions

- none
