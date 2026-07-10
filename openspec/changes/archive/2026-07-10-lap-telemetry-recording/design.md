# Design — Lap Telemetry Recording & Analysis

## Context

The web app currently keeps three partial, disconnected views of lap data:

- `TrackMap.tsx` stores per-lap line samples (`x, z, gas, brake, speedKmh`) for drawing, capped at 40 laps / 25k samples.
- `useLapDelta` records `{ pos, timeMs }` per lap but only keeps the single fastest as a delta reference; everything else is discarded.
- `useLapHistory` keeps `{ lap, timeMs, invalid }` records with no trace data at all.

Every field needed for real analysis (`normalizedPos`, `lapTimeMs`, `speedKmh`, `gas`, `brake`, `gear`, `steerAngle`) already arrives in each `TelemetryFrame` — the data is streamed and thrown away. This change adds a proper session-scoped recording store and consumers that turn it into actionable analysis.

Constraints inherited from the codebase:

- The driver's window focus belongs to the game. **Every interaction must work with hover only — no clicks, ever** (user directive; the follow-cam comment in `TrackMap.tsx` documents why clicks are harmful).
- Canvas rendering must be dirty-gated rAF (repo convention).
- Session restart is detected by the lap counter or lap clock running backwards — a signature currently duplicated in `useLapHistory`, `useLapDelta`, and `TrackMap`.
- Hooks bookkeeping runs on the ~30 Hz throttled `telemetry` state; full-rate data lives in `telemetryRef`.

## Goals / Non-Goals

**Goals:**

- One authoritative per-lap telemetry recording store, full stream rate, position-indexed, memory-bounded, session-scoped.
- A lap analysis panel: speed + pedal traces and a continuous time-delta trace of a selected lap vs. the session-best valid lap, hover-scrubbable.
- Mini-sector splits per lap, best-sector highlighting, session theoretical-best.
- Track-map hover readout upgraded to show throttle/brake/gear per lap at the hovered point; braking-point markers per colored lap.

**Non-Goals:**

- No bridge or wire-protocol changes; no changes to the hand-mirrored `types.ts` contract.
- No persistence across page reloads or sessions (matches every other store in the app).
- No refactor of the existing `useLapDelta` / `useLapHistory` / `TrackMap` restart detection — the new hook implements the same signature; consolidation is a separate cleanup.
- No telemetry export (CSV/MoTeC) — future work the recording store enables.

## Decisions

### D1: Recording is driven by WebSocket frame arrival, not rAF and not the throttled state

While the driver plays, the browser window is unfocused and often occluded — rAF throttles or stops, so a rAF-driven recorder would silently produce garbage laps. The 30 Hz throttled state costs ~2.3 m between samples at 250 km/h, blurring brake points. Instead, `useTelemetry` gains a tiny frame-subscription API (`subscribeFrame(cb): unsubscribe`), invoked synchronously for every WS telemetry message alongside the existing `telemetryRef` update. The recorder subscribes there and captures at full bridge rate (60 Hz ≈ ~1 m spacing at speed — matching the map's sampling intent).

*Alternative considered:* record inside `TrackMap`'s existing rAF sampler and share the store — rejected: couples analysis data to a display component and inherits rAF's visibility throttling.

### D2: One new hook owns the store: `useLapRecordings`

Follows the established derived-data hook pattern: bookkeeping internal, results exposed as refs for rAF consumers, plus a monotonically increasing `version` signal for React consumers that need re-renders (mirrors `cutSeq`).

Data model:

```ts
type LapTelemetrySample = {
  pos: number;      // normalizedPos, strictly increasing within a lap
  timeMs: number;   // lapTimeMs at capture
  speedKmh: number;
  gas: number;      // 0–1
  brake: number;    // 0–1
  gear: number;
  steerAngle: number;
};

type LapRecording = {
  lap: number;            // display convention (lapCount N completes "Lap N+1")
  timeMs: number | null;  // completed lap time; null while in progress
  complete: boolean;      // covered ≥ [0.05, 0.95] of the lap (useLapDelta's rule)
  samples: LapTelemetrySample[];
};
```

- Samples append only when `pos` strictly increases (same glitch guard as `useLapDelta`).
- Lap boundary: `lapCount` tick promotes the in-progress recording to completed, stamping `timeMs` from the refreshed `lastLapMs` (reusing `useLapHistory`'s pending/refresh discipline so back-to-back identical times are handled).
- Restart signature (lap counter or lap clock backwards) discards the in-progress recording and clears the store; session change clears everything. Same rules, kept textually in sync with the existing three sites.
- Validity is *not* re-derived: consumers join against `useLapHistory`'s `lapsRef` by lap number.

**Bounds:** completed laps capped at 30 (oldest complete lap dropped, except the session-best valid lap which is pinned); samples per lap capped at 12,000 (~3 min lap at 60 Hz — beyond the cap the lap keeps recording time but stops appending, marked `complete: false` so it never becomes a reference). Worst case ≈ 30 × 12k × 7 numbers ≈ 20 MB — acceptable for a dashboard session.

### D3: Alignment and delta are computed by position interpolation, on demand

The lap-vs-lap delta trace reuses `useLapDelta`'s bracketing-binary-search interpolation: for a pos grid, `delta(pos) = timeMs_selected(pos) − timeMs_reference(pos)`. Computed lazily in the analysis panel's render path (not stored), because it's cheap (one pass over ~7k samples) and only needed while the panel is visible. The **reference lap** is the fastest *valid, complete* recorded lap (validity from `useLapHistory`); the **selected lap** defaults to the most recent complete lap and follows user selection.

### D4: Analysis panel — canvas traces, distance-domain x-axis, everything hover-driven

A new `LapAnalysis` panel renders three stacked, shared-x-axis canvas strips: speed (km/h), pedals (throttle/brake overlaid, 0–100%), and delta (± seconds vs. reference, zero-centered). X-axis is normalized track position — distance-aligned comparison is the standard racing-telemetry view and makes "braked later into T3" directly visible; a time-domain axis would smear differences across the lap.

- Hovering the strips shows a shared vertical scrub cursor with numeric readouts for both laps at that position, and publishes the scrub position through a ref so `TrackMap` can draw a marker dot at the corresponding point on the selected lap's line — closing the loop between "where on the graph" and "where on the track". Hover-only, no click, no focus.
- Lap **selection** is a row list of recorded laps (number, time, validity coloring reusing the lap-list conventions) — **hover-only, like every interaction in this app** (user directive: no clicks anywhere; clicks focus the browser and steal controller input from the game). Hovering a row selects that lap, and the selection *sticks* when the pointer leaves — the last-hovered lap stays selected, so no dwell timer or commit gesture is needed. Until any row has been hovered, selection follows the most recent complete lap.
- All strips dirty-gate their rAF: repaint only when selection, reference, scrub position, recording version, or canvas size changes. The in-progress lap's trace grows live (version bumps on the throttled state cadence are sufficient for a growing chart).

*Alternative considered:* extend `PedalTrace` (time-domain ring buffer) — rejected: different domain (wall-clock vs. track position), different lifetime (10 s vs. whole session).

### D5: Mini-sectors are fixed equal slices of normalized position

The track is divided into 24 equal `normalizedPos` slices (no corner metadata exists in the assets the bridge reads, and equal slices are how most sim timing tools do micro-sectors). Sector time = interpolated elapsed time at slice end − at slice start, computable for any lap whose samples cover the slice. Derived lazily from recordings (pure function, memoized by recording version) rather than stored.

- Per-lap sector strip in the analysis panel: each slice colored by comparison — best-so-far sector (across valid laps) in the accent/best color, within 0.05 s of best in a neutral tone, slower in muted; rendered with design tokens, exact tokens chosen at implementation.
- Theoretical best = Σ min(valid sector times); displayed alongside session best so the gap ("you have a 1:41.8 in you") is explicit.

### D6: Track-map additions stay inside existing structures

- `TrackMap`'s `Sample` gains `gear` (one field, captured at the same place gas/brake already are). The hover readout rows extend from `Lap N · 143 km/h` to include gear and a compact throttle/brake indication at the nearest sample. No dependency on `useLapRecordings` — the map's own samples already carry what's needed, keeping the map self-contained.
- Braking-point markers: for each completed lap, mark samples where `brake` crosses onset (rising through 0.2 after ≥ 25 m of no braking — hysteresis + distance gate suppress trail-brake flutter), drawn as short ticks in the lap's identity color. Computed once per completed lap and cached with the lap entry; current lap excluded (its pedal gradient already shows braking live). **Reveal, not ambient** (user feedback: all-laps ticks are noise): ticks render only for the focused lap — its line hovered on the map, its row hovered in the session-lap list (`hoveredLapRef`), or the analysis panel's selected lap while the panel is open (a third shared ref, `analysisLapRef`).

## Risks / Trade-offs

- **[4th copy of the restart signature]** → The new hook documents the duplication and CLAUDE.md's keep-in-sync note covers it; consolidation into a shared helper is deliberately deferred to avoid touching three working call sites in this change.
- **[Memory growth on marathon sessions]** → Hard caps (30 laps × 12k samples) with best-lap pinning; caps are constants next to the store with rationale comments, in the `MAX_SAMPLES`/`MAX_LAPS` tradition.
- **[Full-rate subscription adds work on the WS hot path]** → The recorder does O(1) appends per frame (push + monotonic check); no allocation-heavy work on the message path. Analysis math runs lazily in render paths.
- **[Equal mini-sectors may split mid-corner]** → Accepted; without corner metadata any segmentation is arbitrary, and 24 slices are fine-grained enough that a corner spans ~1–2 slices. Slice count is a constant, easy to tune.
- **[Panel real estate on the existing dashboard grid]** → Resolved by user feedback: the panel is a slim always-visible bar that pops out as a hover-revealed overlay above the map (the Lap tile's session-list pattern) — the map keeps its full area at all times.
- **[Invalid laps as "best"]** → User directive: an invalid lap is never a reference, session best, or best-lap tile value. `resolveReference` is strictly valid-only (no fallback); the Best-lap tile overrides the game's `bestLapMs` when the log knows that time belongs to a cut lap.
- **[Scrub-marker coupling between panel and map]** → Communicated via a shared ref (like `hoveredLapRef` already is), not React state — no render coupling, and either side works when the other is absent.

## Open Questions

None blocking — token choices for sector coloring and the exact panel placement in the grid are implementation-time calls within existing conventions.
