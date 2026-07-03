# Design — racer-stats-ui

## Context

The app is a two-workspace monorepo: `bridge` (Node, talks AC's UDP remote-telemetry protocol, re-broadcasts JSON over WebSocket on port 3001) and `web` (React 19 + Vite + Tailwind v4, canvas track map). The bridge already receives the full 328-byte RTCarInfo packet at ~30 Hz but `parseRTCarInfo` decodes only a subset. The web app consumes frames two ways: React state (`telemetry`, re-renders at frame rate) and a mutable ref (`telemetryRef`) read from `requestAnimationFrame` loops.

RTCarInfo layout (MSVC alignment, verified against the existing offsets in `parsers.ts`): bools `isAbsEnabled..isEngineLimiterOn` at bytes 20–25; floats `accG_vertical/horizontal/frontal` at 28/32/36; `clutch` at 64; `steer` at 72; the fifteen `float[4]` blocks start at 84 — `tyreSlip` is block index 4 (offset 148) and `load` is block index 6 (offset 180); `carSlope` at 312.

## Goals / Non-Goals

**Goals:**
- Decode the remaining RTCarInfo fields the UI needs; keep the WS protocol additive.
- Throttle/brake/coast gradient driving line on the track map, persisting per lap.
- Instrument cluster (gear, RPM bar + redline + limiter flash, speed, ABS/TC/PIT lights), pedal trace, G-meter, steering bar, live delta-to-best.
- Everything renders smoothly at 30 Hz input / 60 fps canvas without new dependencies.

**Non-Goals:**
- No historical persistence (sessions/laps are not saved to disk).
- No multi-car / opponent data (AC's SUBSCRIBE_SPOT, sector times, fuel, tyre temps — not in RTCarInfo).
- No mobile-first layout work beyond the existing responsive grid.
- No changes to the handshake/session lifecycle in `acClient.ts`.

## Decisions

### D1: Extend `parseRTCarInfo` in place; additive JSON fields
Add the new reads to the existing parser and widen `TelemetryFrame` in both `types.ts` files (they are kept in sync by convention, per the comment in `web/src/types.ts`). Alternative — a versioned v2 message type — rejected: single consumer, additive fields are backward compatible, and the frame is already sent as plain JSON. Booleans are read with `readUInt8(...) !== 0`. Arrays (`tyreSlip`, `wheelLoad`) are 4-element number arrays in wheel order FL/FR/RL/RR.

### D2: Gradient line as an accumulated segment list with per-segment color, drawn incrementally
`TrackMap` already keeps a breadcrumb array; generalize it: each sample stores `{x, z, gas, brake}`. Color is computed per segment at draw time: `brake > DEAD_ZONE && brake >= gas` → red, `gas > DEAD_ZONE` → green, else yellow, with the saturated color lerped by pedal magnitude so partial throttle reads as softer green (dead-zone ≈ 0.05). Draw as short `lineTo` strokes per segment (the current trail already strokes per segment, so this is the same cost profile). Sample when the car moves > 0.5 m, same as today — a lap is a few thousand segments, trivially cheap for canvas at 60 fps.

Lap lifecycle: watch `lapCount` in the rAF loop via `telemetryRef`; when it changes (or session changes), clear the segment list. The old 150-point fading trail is replaced by the full-lap line; the car dot stays.

Fallback (no map image) mode reuses the same sample list for both the outline and the gradient — the gradient line *is* the outline, so the separate breadcrumbs array collapses into the new structure.

Alternative — offscreen canvas that accumulates strokes and never redraws old segments — rejected for now: full redraw each frame is simpler, keeps resize/DPR handling trivial, and segment counts are small. Revisit only if profiling shows cost.

### D3: Pedal trace and G-meter render on canvas from a shared ring buffer, not React state
A new `useInputHistory` ring buffer (fixed capacity ≈ 12 s × 30 Hz = 360 samples of `{t, gas, brake, clutch, accGH, accGF}`) is appended from the telemetry WS handler (or a small effect watching `telemetry`). Pedal trace and G-meter components read it inside their own rAF loops via ref — same pattern as `TrackMap` — so 30 Hz updates never trigger extra React renders for chart redraws. Alternative — SVG/recharts — rejected: adds a dependency and re-render pressure for a strictly real-time chart.

### D4: Delta-to-best computed client-side from `normalizedPos`
A `useLapDelta` hook records `(normalizedPos, lapTimeMs)` samples for the current lap into an array (append-only; `normalizedPos` is monotonic within a lap except at the start/finish wrap). On lap completion (`lapCount` increment): if `lastLapMs` is a new session best (and the recording covered the lap — first sample near 0, last near 1 — to avoid garbage from out-laps/joins), promote the recording to the reference lap. Live delta = current `lapTimeMs` − reference time at the same `normalizedPos` (linear interpolation between the two bracketing reference samples). Show placeholder until a reference exists. Alternative — using AC's best-lap field with distance-based estimation — rejected: RTCarInfo provides no per-position best-lap data; recording it ourselves is the standard approach.

### D5: Layout — three-zone grid, keep Tailwind theme, add a few tokens
`App.tsx` becomes: header (unchanged) / main grid `lg:grid-cols-[22rem_1fr]`; left column stacks instrument cluster (with status lights), lap times + delta, pedal trace, G-meter + steering row; right side is the gradient track map. Add theme tokens: `--color-redline` (can alias `critical`), `--color-coast` (yellow, can alias `warning`), status-light on/idle/off handled with opacity rather than new colors. All numeric readouts use `tabular-nums` (already the codebase pattern). `LiveStats.tsx` is replaced by `InstrumentCluster.tsx`, `PedalTrace.tsx`, `GForceMeter.tsx`, `SteeringBar.tsx`. Components stay arrow functions per user code style.

### D6: Limiter flash via CSS animation keyed on a prop
When `engineLimiterOn`, apply a Tailwind `animate-pulse`-style class to the RPM bar. No rAF-driven flashing — CSS keeps it off the JS hot path.

## Risks / Trade-offs

- [RTCarInfo offsets differ across AC builds] → Offsets are derived from the same struct/alignment already validated by the working fields (e.g. `rpm` at 68, `gear` at 76 bracket `steer` at 72); verify live against a real session during implementation before styling work.
- [Full-lap redraw cost on long tracks (Nordschleife ≈ 20 km ⇒ ~40k segments at 0.5 m)] → Raise the sample spacing to ~2–3 m for the persistent line (braking-point resolution is still ample) and/or cap samples per lap; fall back to an accumulating offscreen canvas only if needed.
- [`normalizedPos` glitches near start/finish or during resets break the delta] → Guard: ignore samples where `normalizedPos` decreases mid-lap; require lap coverage before promoting a reference; clamp interpolation to the reference range.
- [React re-render pressure from 30 Hz `setTelemetry`] → Already the status quo; new heavy visuals (map, trace, G-meter) all read refs inside rAF, so the restyle doesn't add render-bound work. Cluster/lights/delta are cheap DOM updates.
- [Best lap from AC (`bestLapMs`) may predate our recording (e.g. app opened mid-session)] → The delta reference only uses laps recorded while the app was open; `bestLapMs` display remains AC's value. Acceptable mismatch, shown placeholder until we have our own reference.

## Migration Plan

Additive change, no persisted state, single-user app: deploy bridge and web together via `npm run dev`/`build`. Rollback = revert the change. No data migration.

## Open Questions

- Exact redline RPM is not in RTCarInfo; the RPM bar scales to the observed session max (rolling max with a sensible 8,000 rpm floor). Good enough for v1; a per-car config table could refine it later.
