## Why

Sectors are eight equal slices of normalized track position. On the Nordschleife each slice is ~2.6 km and spans several corners, so "S3" names nothing a driver can act on. AC already ships the real names: `data/sections.ini` in the track folder lists named sections (39 on the Nordschleife — Hatzenbach, Flugplatz, Fuchsröhre…) with their normalized positions, in the same folder the bridge already reads `map.ini` from.

## What Changes

- The bridge reads the track's `data/sections.ini` and sends its named sections on the `session` message as an additive optional field.
- The web derives one **sector division** per session: where the track names its sections, one sector per named section, with boundaries midway between neighbouring sections; otherwise the eight equal slices of today.
- The analysis panel's ribbon, scrub band and ownership readout, and the track map's division, labels and scrub emphasis, all follow that division and name sectors by their section name.
- Map sector labels that would overlap at the current zoom are omitted; they return as the driver zooms in.
- The theoretical best keeps being computed over the eight equal slices on every track, so it stays the conservative figure the spec asks for.

## Capabilities

### New Capabilities

none

### Modified Capabilities

- `track-asset-resolution`: adds resolving named sections from `data/sections.ini` and carrying them on the `session` message.
- `mini-sector-timing`: the split is no longer always equal slices — it follows the track's named sections when available; the ribbon's boundary alignment, the ownership readout's sector name and the theoretical best's basis change with it.
- `track-sector-division`: the map follows the session's division rather than a fixed count, labels sectors by name, and culls colliding labels.

## Out of Scope

- The per-lap time-loss ranking by section, the persistent all-time best lap, and spoken section deltas — each a later change built on this one.
- Corner-only analysis from each section's own `IN`/`OUT` span (minimum speed, braking point). The span travels on the wire but nothing reads it yet.
- Re-recording the committed Imola demo. It was recorded before this field existed, so the demo build keeps the equal slices until someone re-records it.
- Hand-authored section names for tracks that ship no `sections.ini`.

## Impact

- `packages/protocol/src/index.ts`: new `TrackSection` type and optional `sections` on `SessionInfo`. Additive and ignorable by older peers, so `PROTOCOL_VERSION` stays at 1.
- `bridge/src/content/`: a new `sections.ini` parser beside `trackAssets.ts`, which resolves it with the same layout-aware directory order.
- `web/src/lib/`: a new sector-division module; `sectorTimes`, `bestSectors` and `sectorOwners` take boundaries instead of a count.
- `web/src/components/LapAnalysis/` (`constants.ts`, `traceLayer.ts`, `scrubOverlay.ts`, `index.tsx`) and `web/src/components/TrackMap/` (`trackGeometry.ts`, `markers.ts`, `layers.ts`, `index.tsx`): read the session's division in place of `SECTOR_COUNT`.
- `web/src/App.tsx`: derives the division once per session and hands it to both components.
- No new dependency. The session message grows by about 2 KB on the Nordschleife.
