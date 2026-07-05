## 1. Wire contract (types)

- [x] 1.1 Add `topSpeedKmh: number | null` to `SessionInfo` in `bridge/src/types.ts`
- [x] 1.2 Mirror the same field in `web/src/types.ts` (keep the two `SessionInfo` copies in sync)

## 2. Bridge: resolve car top speed

- [x] 2.1 Create `bridge/src/carAssets.ts` exporting `resolveCarTopSpeed(carName: string): number | null`, reusing the resolved `AC_PATH` (share/lift the discovery already in `trackAssets.ts` rather than duplicating it)
- [x] 2.2 Read `content/cars/<carName>/ui/ui_car.json` as text (no `JSON.parse`); extract the `topspeed` field via regex and take its first numeric run; return `null` for missing file, missing key, placeholder, or non-numeric values (`"--km/h"`, `"---"`, empty). Verify `"322+km/h"` → `322` and `"211km/h"` → `211`
- [x] 2.3 In `bridge/src/index.ts` `ac.on('session', …)`, call `resolveCarTopSpeed(handshake.carName)` alongside `resolveTrackAssets` and include `topSpeedKmh` in the `session` object that is stored and broadcast

## 3. Web: derive the speedometer scale

- [x] 3.1 Add a pure helper (e.g. `speedScale(topSpeedKmh: number | null): { max: number; majorTickStep: number }`) that returns `{ max: 320, majorTickStep: 40 }` when null, else applies the ×1.08 headroom, rounds the max up to a clean value, and derives a round `majorTickStep` giving ~6–8 labeled ticks
- [x] 3.2 Sanity-check the helper across the observed top-speed range (~150–370 km/h) so tick labels stay round at both ends (e.g. 211→clean scale, 322→clean scale)

## 4. Web: apply the scale to the cluster

- [x] 4.1 Pass `session` (or the derived `{ max, majorTickStep }`) into `InstrumentCluster` from `App.tsx`
- [x] 4.2 In `InstrumentCluster.tsx`, replace the hard-coded `SPEED_MAX_KMH` / speed `majorTickStep` with the derived values from `speedScale(session.topSpeedKmh)`; leave the tachometer gauge untouched

## 5. Verify

- [x] 5.1 `npm run build -w bridge` (type-check) and `npm run build -w web` both pass; `npm run lint -w web` clean
- [x] 5.2 Run `npm run mock -w bridge` + web: confirm the mock car (`abarth500`) yields a ~211-derived clean scale, the needle uses most of the dial, and the digital readout still matches
- [x] 5.3 Confirm fallback: a car/session with no resolvable top speed shows the fixed 0–320 scale with 40 km/h ticks and no errors
