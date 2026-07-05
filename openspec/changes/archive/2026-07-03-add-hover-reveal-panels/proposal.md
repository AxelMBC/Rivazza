# Proposal: add-hover-reveal-panels

## Why

The dashboard shows only the current/last/best lap — there is no way to see all laps driven this session, and laps the game invalidated are indistinguishable from clean ones. Additionally, tyre slip and wheel load are already parsed and streamed on every telemetry frame but never displayed. Because clicking the browser steals focus from Assetto Corsa (control inputs stop reaching the game), any new information must be revealed through hover or scroll — interactions that work without window focus.

## What Changes

- New `useLapHistory` hook in the web app that accumulates a per-lap record (lap number, time, validity) by watching `lapCount` increments — same technique the track map already uses to archive lap lines.
- Heuristic lap invalidity (the UDP protocol carries no validity flag): a lap is marked invalid when it beat `bestLapMs` but the game did not adopt it as best, or when `inPit` was true at any point during the lap. Exact cut detection via shared memory is explicitly deferred.
- Hovering the "Lap" counter tile in the lap-times section reveals a panel listing every recorded lap with its time; invalid laps render in red, the best lap in the best-lap accent color. The panel scrolls if it outgrows its height.
- The existing track-map lap-line hover label is enriched from "Lap N" to include that lap's time, shown in red when the lap is invalid.
- Hovering the instrument cluster reveals a per-wheel overlay (FL/FR/RL/RR layout) showing tyre slip and wheel load from the already-streamed `tyreSlip` and `wheelLoad` arrays.
- Design rule adopted for all of the above: information reveals are driven purely by hover (CSS `:hover`/`group-hover` or mousemove) or scroll — never click, keyboard, or focus.

## Capabilities

### New Capabilities

- `lap-history`: Session-scoped lap log — accumulating per-lap records with heuristic validity from the telemetry stream, the hover-revealed lap list panel, and the enriched track-map hover label.

### Modified Capabilities

- `racer-dashboard`: New requirement — hover-revealed per-wheel tyre slip/load overlay on the instrument cluster; new requirement — focus-safe interaction rule (reveals via hover/scroll only, no click/focus).

## Impact

- **Web only** — no bridge or protocol changes. All required data (`lastLapMs`, `bestLapMs`, `lapCount`, `inPit`, `tyreSlip`, `wheelLoad`) already arrives in every `TelemetryFrame`.
- New: `web/src/hooks/useLapHistory.ts`, `web/src/components/TyreOverlay.tsx` (or equivalent).
- Modified: `web/src/App.tsx` (wire hook), `web/src/components/LapTimes.tsx` (hover panel on Lap tile), `web/src/components/TrackMap.tsx` (hover label gains time/validity), `web/src/components/InstrumentCluster.tsx` (hover overlay).
- Known limitation (accepted): the lap log only contains laps driven while the dashboard was open, and heuristic invalidity misses cut laps that were also slower than best. A future shared-memory bridge upgrade could make validity exact.
