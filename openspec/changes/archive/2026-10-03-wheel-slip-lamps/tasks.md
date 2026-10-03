## 1. Spike: find a live slip source (needs the real game)

- [x] 1.1 Write a throwaway logger in the session scratchpad (not committed). It listens to RTCarInfo the way `ACClient` does and prints per-wheel floats at @100, @132, @148, @164, and, on Windows, reads `Local\acpmf_physics` @56 the way `sharedMemory.ts` does
- [x] 1.2 With the game running, log steady driving, wheelspin/drift and hard braking. (One car logged. The second-car check moved to 4.5, since `ndSlip` is normalised)
- [x] 1.3 Pick the source by design D1's order and fill "Spike outcome" in `design.md`: UDP `ndSlip` @164, `SLIP_ON` 1.2 / `SLIP_OFF` 0.9, cap 50
- [x] 1.4 ~~If the source is shared memory: add a `cut-detection` delta~~. Not applicable, UDP won

## 2. Bridge

- [x] 2.1 `parsers.ts`: decode `tyreSlip` from offset 164, capping each wheel at `SLIP_CAP` and mapping non-finite values to the cap
- [x] 2.2 `bridge/scripts/mock-ac.js`: write slip at offset 164. Below-1 baseline, with periodic short excursions alternating rears-only and fronts-only

## 3. Web

- [x] 3.1 Add `SLIP_ON` / `SLIP_OFF` / critical-grade constants in one place the lamps and the overlay both import
- [x] 3.2 `useWheelSlipLamps(telemetry)`: per-wheel lit state with hysteresis, updated only on threshold crossings
- [x] 3.3 `InstrumentCluster/index.tsx`: 2×2 FL/FR/RL/RR `StatusLight` block between the ABS/TC row and PIT, `activeClass="bg-warning"`, muted before the first frame
- [x] 3.4 `TyreOverlay.tsx`: warning grade from `SLIP_ON`, critical from the shared critical constant

## 4. Verification

- [x] 4.1 Run `/opsx:verify`: bridge and web typecheck, lint, formatting and the spec deltas
- [ ] 4.2 With the mock and `npm run dev` running: the lamp block sits under ABS/TC in car layout, RL+RR light during the mock's rear excursion and FL+FR during the front one, and all four go dark between excursions without flicker
- [ ] 4.3 With the mock running and the cluster hovered: overlay slip numbers enter warning/critical on the same wheels the lamps show
- [ ] 4.4 `npm run dev:demo` with the old recording: lamps render dark (not muted) and never light, and the console stays clean
- [ ] 4.5 With the real game, on two cars with different grip: lamps light in drifts, wheelspin and lock-ups, and stay dark through a clean lap at the limit
