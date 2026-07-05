# Design: add-hover-reveal-panels

## Context

The web app receives a `TelemetryFrame` stream (~ every UDP update) containing `lapTimeMs`, `lastLapMs`, `bestLapMs`, `lapCount`, `inPit`, `tyreSlip[4]`, and `wheelLoad[4]`. AC's remote telemetry protocol streams no lap list and no lap-validity flag — history must be accumulated client-side. `TrackMap.tsx` already does this for driving lines: it watches `lapCount` increment, archives the current lap's samples, and detects session restarts by the lap counter or current lap time running backwards.

Hard constraint from the user's setup: clicking the browser window steals focus from Assetto Corsa and control inputs stop reaching the game. Mouse hover and wheel scroll are delivered to unfocused windows on Windows, so all new reveals must be hover/scroll-driven.

## Goals / Non-Goals

**Goals:**
- A session lap log (number, time, validity) available to any component.
- Hover-revealed lap list on the Lap tile; invalid laps in red, best lap accented.
- Track-map hover label upgraded with the lap's time and validity color.
- Hover-revealed per-wheel tyre slip/load overlay on the instrument cluster.
- All reveals work without the browser window having focus.

**Non-Goals:**
- Exact cut detection. AC exposes `numberOfTyresOut` only via Windows shared memory; adding a native shared-memory reader to the bridge is deferred to a future change.
- Persisting lap history across page reloads or sessions.
- Multi-car / opponent lap times (the protocol is single-car).

## Decisions

### 1. Lap history accumulates in a web hook, not the bridge

`useLapHistory(telemetry)` in the web app, mirroring `useInputHistory` / `useLapDelta` patterns. The bridge stays a stateless protocol translator (its current design), no WebSocket message changes, and the hook can piggyback on the restart-detection logic proven in `TrackMap`. Alternative — accumulate in the bridge and stream a `laps` message — was rejected: it adds protocol surface for data derivable client-side, and a bridge restart would lose the log anyway.

On each frame the hook tracks the current lap's `inPit` union and pending best. When `lapCount` increments, it records `{ lap: prevLap + 1, timeMs, invalid }` (display convention "lapCount N = Lap N+1" matches the LAP tile and map). It resets on session change and on the restart signature (`lapCount` decreasing, or same-lap `lapTimeMs` running backwards — same rule as `TrackMap.tsx:260-264`).

Lap time source: `lastLapMs` as of the first frame where `lapCount` has incremented; if that frame still carries the previous value (to be verified live), wait until `lastLapMs` changes before recording — never record a 0 or stale time.

### 2. Heuristic validity: best-didn't-update OR touched pit

A completed lap is `invalid` when either:
- its time is lower than the `bestLapMs` in effect before the lap completed, but `bestLapMs` did not adopt it (the game rejected a would-be best → cut lap), or
- `inPit` was true at any point during the lap (out-lap / pit-through).

First lap of a stint with no prior best: if `bestLapMs` stays 0/unset after completion, treat as invalid the same way. Accepted miss: a cut lap slower than best reads as valid. This is documented in the panel's caveat and in the proposal; the shared-memory route is the future fix.

### 3. Lap list reveal: CSS group-hover on the Lap tile, absolutely-positioned panel

The Lap counter tile in `LapTimes` becomes a `group relative`; the panel is an absolutely positioned card (`invisible opacity-0 group-hover:visible group-hover:opacity-100`, small transition) overlaying upward/over the column, `max-h` + `overflow-y-auto` for long sessions. Pure CSS hover means no click/focus involvement by construction, and the panel disappears when the mouse leaves. Rows: lap number, `tabular-nums` time; `text-critical` when invalid, `text-best` for the fastest valid lap. Alternative — always-visible scrolling list — rejected: permanent vertical space is scarce in the left column and the user explicitly wants reveal-on-hover.

### 4. Map label enrichment reads from the same hook

`TrackMap` receives the lap records (prop) and `drawHoverLabel` looks up the hovered lap number to render `Lap 3 — 1:42.118`, time in red when invalid. Lookup is by lap number (both structures already use the same "Lap N+1" convention). Laps driven before page load appear on neither structure, so they stay consistent.

### 5. Tyre overlay: group-hover swap inside the instrument cluster section

Hovering the cluster fades in an overlay with four tiles in car layout (2×2: FL FR / RL RR), each showing tyre slip (formatted, colored good→warning→critical by slip magnitude) and wheel load (kN). Implementation as a sibling absolutely-positioned layer over the gauges (`group-hover:opacity-100`), so gauges stay mounted and animating beneath — no re-render churn. Values render from the live `telemetry` prop each frame like other tiles.

### 6. Interaction rule as a spec requirement

"Reveals must not require click/focus" is captured as a requirement in `racer-dashboard` so future changes inherit the constraint rather than rediscovering it.

## Risks / Trade-offs

- [Heuristic misses slow cut laps] → Documented caveat; red is "known invalid", white is "not known invalid". Future shared-memory change makes it exact.
- [`lastLapMs` update timing vs `lapCount` increment is unverified] → Hook records only once `lastLapMs` is fresh (changed or nonzero); verify against live game during implementation.
- [Hover panel overlapping other tiles could trap the cursor into flicker] → Panel anchored so the hover-trigger tile remains under the cursor path; `pointer-events-none` on purely informational overlays (tyre overlay) so they never affect hit-testing.
- [Session restart heuristics diverge between TrackMap and the hook] → Reuse the exact same restart signature; consider extracting a shared helper if drift becomes an issue.
