# Name sectors after the track's own sections from sections.ini

## 1. Wire contract

- [x] 1.1 In `packages/protocol/src/index.ts`, add `TrackSection = { name: string; in: number; out: number }` and `sections?: TrackSection[] | null` on `SessionInfo`. Leave `PROTOCOL_VERSION` at 1.

## 2. Bridge: resolve the sections

- [x] 2.1 Add `bridge/src/content/sectionsIni.ts` exporting a pure `parseSectionsIni(bytes: Buffer): TrackSection[] | null`: strip a BOM, decode UTF-8 with a Windows-1252 fallback, read `[SECTION_n]` blocks by header (not by index), trim names and strip control characters, drop blocks failing `0 ≤ IN < OUT ≤ 1` or with an empty name, sort by `IN`, drop a section whose `OUT` is not greater than the previous kept one's, return `null` under two survivors.
- [x] 2.2 Add `bridge/src/content/sectionsIni.test.ts` covering each scenario of "Bridge resolves named track sections": BOM before the first header, UTF-8 and Windows-1252 umlauts, trailing whitespace, malformed blocks, a nested section, out-of-order blocks, fewer than two survivors.
- [x] 2.3 In `trackAssets.ts`, add `sections` to `TrackAssets`, resolved from the first existing `data/sections.ini` among the layout-aware candidates with no fall-through, wrapped so a read or parse failure logs once and yields `null`. Return the assets when any of `meta`, `edges` or `sections` resolved, keeping the "no map data" warning for the `meta`/`edges` case.
- [x] 2.4 Carry `sections` on the `session` message wherever `meta` and `edges` are attached (the broadcast and the `hello` greeting), sending `null` when unavailable.

## 3. Web: the sector division

- [x] 3.1 Add `web/src/lib/sectorDivision.ts` with the `SectorDivision` type, `equalDivision(count)`, `divisionFromSections(sections)` (midpoint boundaries, first at 0, last at 1), `sessionDivision(sections)` choosing between them (missing or `null` → equal), `sectorIndexAt(division, pos)` as a binary search, and `sectorLabel(division, i)` returning the name or `S{i+1}`.
- [x] 3.2 Add `web/src/lib/sectorDivision.test.ts`: the 0.148/0.161 → 0.1545 boundary, first bound 0 and last bound 1, names in lap order, `undefined` and `null` sections giving the equal division, `sectorIndexAt` at 0, at a boundary, and at 1.
- [x] 3.3 Change `sectorTimes`, `bestSectors` and `sectorOwners` in `lapAnalysis.ts` to take `bounds` instead of `count`; update `lapAnalysis.test.ts` and add a case with unequal bounds. Replace the stale comment above `SECTOR_COUNT`.
- [x] 3.4 In `App.tsx`, derive the division once per session with `useMemo` and pass it to `LapAnalysis` and `TrackMap`.

## 4. Web: analysis panel

- [x] 4.1 `LapAnalysis/constants.ts`: replace the `SECTOR_COUNT` slice lookup with `sectorIndexAt` over the division.
- [x] 4.2 `LapAnalysis/traceLayer.ts`: draw the ribbon from `bounds`, with the seam clamped so no slice disappears; include the division in the layer's cache key.
- [x] 4.3 `LapAnalysis/scrubOverlay.ts`: band the scrubbed slice from `bounds` and name it with `sectorLabel` in the readout.
- [x] 4.4 `LapAnalysis/index.tsx`: compute owners over the session's division, and keep `bestSectors` and the theoretical best on `equalDivision(SECTOR_COUNT)`.

## 5. Web: track map

- [x] 5.1 `TrackMap/trackGeometry.ts`: build the sector vertex runs from the division's `bounds` instead of `SECTOR_COUNT`.
- [x] 5.2 `TrackMap/markers.ts`: compute owners over the division and label sectors with `sectorLabel` (owner and `INV` suffix as today); the scrubbed sector's label is always drawn.
- [x] 5.3 `TrackMap/layers.ts`: place labels longest sector first and skip any whose box overlaps one already placed; ticks are drawn for every boundary regardless.
- [x] 5.4 `TrackMap/index.tsx`: thread the division to the factories as an effect-level input alongside `edges`; confirm the dirty gate needs no new term.

## 6. Docs

- [x] 6.1 In `CLAUDE.md`, mention `data/sections.ini` and the `sections` field in the "Track assets" paragraph.

## 7. Verification

- [x] 7.1 Run `/axl:verify`
- [x] 7.2 In AC on `ks_nordschleife` (layout `nordschleife`), before completing a lap: the map shows sector ticks all round the track and named labels (`Flugplatz`, `Döttinger Höhe` with its umlauts intact), with no two labels overlapping at full fit.
- [x] 7.3 Wheel-zoom into the Wehrseifen–Breidscheid–Ex-Mühle stretch: labels that were missing at full fit appear.
- [x] 7.4 After two flying laps, hover the analysis bar and scrub across the traces: the readout names the section under the pointer (`Fuchsröhre · Lap N · time`), the banded column and the ribbon slice line up, and the same section is emphasized on the map with its label shown even if it was hidden.
- [x] 7.5 In the same panel, the ribbon shows 39 slices of unequal width with `Döttinger Höhe` clearly the widest and `T13` at the far right still visible.
- [x] 7.6 Drive a mod track that ships no `sections.ini` (or temporarily rename the file): sectors read `S1`–`S8` on the map and in the readout, exactly as before this change.
- [x] 7.7 Run `npm run dev:demo`: the committed Imola recording loads without a protocol refusal and shows `S1`–`S8`.
