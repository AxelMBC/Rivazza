## Context

The web app shares a PC with Assetto Corsa. Current rendering costs, measured against what's actually on screen:

- **Three unconditional rAF loops** (`TrackMap.tsx`, `PedalTrace.tsx`, `GForceMeter.tsx`) repaint at display refresh (144+ Hz on gaming monitors) while telemetry arrives at 60 Hz — and keep repainting identical pixels when the game is paused and frames stop.
- **TrackMap redraws everything every frame**: up to `MAX_LAPS = 40` completed laps × ~2–5k samples each re-projected and re-stroked via `drawUniformPath`, the current lap stroked one `beginPath`/`stroke` per 1-meter segment via `drawPath`, plus a fresh `samples.map(project)` array allocation per frame (GC churn).
- **Full React tree re-renders 60×/sec**: `setTelemetry` fires per bridge frame in `useTelemetry.ts`; both `AnalogGauge` SVGs rebuild tick arrays and diff ~100 SVG nodes each render.
- **Stale 30 Hz-era constants**: bridge went 30 → 60 Hz, but `useInputHistory` `CAPACITY = 360` ("~12s at 30 Hz") now holds 6 s — the pedal trace only fills the right half of its canvas, violating racer-dashboard's ≥10 s requirement. `GForceMeter` `PATH_SAMPLES = 60` ("~2s") is now ~1 s. CLAUDE.md still says the bridge flushes at 30 Hz.

Constraints: visuals and interactions must be preserved exactly (the pedal-trace window returning to 12 s is the one intended visible fix, user-confirmed). All reveals stay hover/wheel-only (clicks steal game input focus). The bridge's 60 Hz broadcast is required for the track map's 1-meter line sampling and must not change.

## Goals / Non-Goals

**Goals:**
- Near-zero CPU/GPU when nothing on screen changes (game paused, menus, telemetry stopped).
- Per-frame track-map cost proportional to *new* content (a blit + a few new segments), not session length.
- Halve React render work by decoupling text-state rate (~30 Hz) from data rate (60 Hz).
- Restore the pedal trace's 12 s window and correct stale rate documentation.

**Non-Goals:**
- No bridge changes (60 Hz broadcast, wire format, `types.ts` on either side).
- No devicePixelRatio capping, no `alpha: false` canvases (would blur / corrupt rounded corners).
- No visual redesign, no interaction changes, no new dependencies.

## Decisions

### 1. Dirty-gated rAF loops (keep the loop, early-return when clean)

Keep each `requestAnimationFrame` loop running but return immediately unless something changed. A no-op rAF callback is a comparison — effectively free — and avoids the complexity/races of tearing loops down and restarting them on events.

Per-component dirty conditions:
- **TrackMap**: `telemetryRef.current` identity changed since last draw; mouse moved/left; wheel zoom changed; canvas CSS size or `devicePixelRatio` changed; `mapData` changed (its effect restarts the loop anyway); fallback-mode viewport still easing. Lap records and legend only change when frames flow, so "new frame" covers them.
- **PedalTrace**: the trace is time-scrolled (`x` derives from `performance.now()`), so it must keep repainting **while any sample is younger than `WINDOW_MS`** — preserving the existing behavior where a paused game's trace visibly slides away over 12 s. Once history is empty or fully aged out: one final clearing draw, then idle. Size/dpr change also dirties.
- **GForceMeter**: purely data-driven (no time scrolling) — redraw only when history changed (length + last sample timestamp) or size/dpr changed.

*Alternative considered*: stop/start the rAF loop from event handlers and a telemetry subscription. Rejected — more moving parts, risk of missed wakeups, no measurable win over an early-return.

### 2. TrackMap offscreen layers, preserving exact draw order

Today's order — map image → non-hovered previous laps → current lap (pedal-colored) → hovered lap emphasis → hover readout → car dot — must produce identical pixels. Two cached layers:

- **Completed-laps layer**: offscreen canvas holding all previous laps except the hovered one, rendered with the existing `drawUniformPath` logic. Invalidated only when: laps array length changes, zoom changes, size/dpr changes, projection inputs change (mapData or fallback view moved), or the hovered lap index changes. Hover-index invalidation keeps the "skip hovered in base pass" semantics pixel-exact rather than relying on the thicker emphasis stroke covering the base stroke's antialiasing fringe.
- **Current-lap layer (incremental)**: offscreen canvas the current lap's segments are *appended* to as samples arrive, using the exact `segmentColor` / jump-skip logic from `drawPath`. Fully redrawn on zoom/size/view change, lap rollover, or session reset. In map mode the base projection is static, so appends dominate; in fallback mode while the camera eases the layer redraws fully each frame — same cost as today, no regression.

The main draw becomes: blit image (as today) → `drawImage(completedLapsLayer)` → `drawImage(currentLapLayer)` → hovered emphasis + readout → dot.

Fallback-mode easing gets a convergence epsilon: when `view` is within ε of `target`, snap and stop marking the view dirty — otherwise the asymptotic easing keeps every frame dirty forever.

Minor: set `canvas.style.cursor` only when the value changes.

*Alternative considered*: single cached layer including the hovered lap, with emphasis drawn on top. Rejected — thicker stroke (LINE_WIDTH+1 vs −0.5) covers the base line but AA edges could differ sub-pixel from today's skip-and-redraw; hover-index invalidation is rare and cheap.

### 3. Split data rate from React state rate in `useTelemetry`

- `telemetryRef` updates on **every** WS message (60 Hz) — TrackMap's sampling fidelity is untouched.
- `setTelemetry` throttles to ~30 Hz: update state only when ≥33 ms elapsed since the last state update, plus a **trailing-edge flush** (a ~33 ms `setTimeout` re-armed on skip) so the last frame always lands when the stream pauses.
- `status` / `session` messages are never throttled.

Safety analysis for the state-driven hooks (`useInputHistory`, `useLapDelta`, `useLapHistory`), which stay on state at 30 Hz — the rate they were originally tuned for:
- `lapCount` is monotonic: a skipped frame can't hide a lap increment, only delay its detection ≤33 ms.
- The restart signature (lap clock running backwards by >1000 ms) survives frame skipping — the backwards jump only grows.
- `useLapHistory`'s pending-lap logic counts frames, not wall time; behavior at 30 Hz matches its original design.
- `useLapDelta` reference resolution halves vs today's accidental 60 Hz — back to the resolution it was designed and shipped with; deltas interpolate between samples.

This decision *implements* the pedal-trace fix for free: at 30 Hz state, `CAPACITY = 360` covers 12 s and `PATH_SAMPLES = 60` covers 2 s — the existing comments become true again. Only comments change in those files.

*Alternative considered*: keep 60 Hz state and `React.memo` the subtrees. Rejected — the `telemetry` prop is a fresh object every frame, so memoization can't skip the components that matter (gauges, tiles). *Alternative*: move the three data hooks onto the ref/socket and throttle only display state. Rejected — more surface area, and it would keep the 6 s pedal-trace bug alive.

### 4. Documentation corrections

CLAUDE.md's throttling paragraph ("fixed 30 Hz") is corrected to describe the 60 Hz bridge broadcast and the web's ~30 Hz text-state throttle. Rate comments in `useInputHistory.ts`, `GForceMeter.tsx`, and `useTelemetry.ts` are updated to name the 30 Hz state rate explicitly.

## Risks / Trade-offs

- [Layer invalidation misses a case → stale pixels on the map] → Enumerate invalidations in one place (a single `layersDirty` check comparing zoom/size/view/lap-count/hover-index against last-rendered values); verify with the mock across zoom, hover, lap completion, restart, and resize.
- [Trailing-edge flush omitted or buggy → last frame never rendered, lap detection delayed until next frame] → Dedicated flush timer re-armed whenever a frame is skipped; covered in verification by killing the mock mid-lap and checking the readouts settle on the final values.
- [PedalTrace gate freezes the trace when telemetry pauses] → Gate keeps animating while any sample is younger than `WINDOW_MS` (time-scroll preserved); idles only after the trace has fully emptied.
- [Fallback easing never converges → map never idles on tracks without map.ini] → Snap-to-target epsilon terminates the easing.
- [Offscreen canvases at map size × dpr add GPU memory] → Two extra buffers at canvas size — bounded, and far cheaper than the per-frame stroke work they eliminate.
- [30 Hz text refresh perceptible?] → Needle already has a 100 ms CSS transition (interpolates identically); numeric text changes faster than readable at either rate. User approved this trade explicitly.

## Migration Plan

Single PR, no data or wire migration. Rollback = revert; no state or protocol changes. Verify before merge with the mock stream (`npm run mock -w bridge` + `npm run dev`): identical visuals across gauges/map/hover/zoom/laps/restart, pedal trace now filling its full width, and Chrome Task Manager showing the CPU/GPU drop plus ~0% repaint when telemetry stops.

## Open Questions

None — the two user-facing decisions (30 Hz text state; 12 s pedal-trace restoration) were put to the user and confirmed.
