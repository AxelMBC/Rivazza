## Context

The speedometer (`web/src/components/InstrumentCluster.tsx`) hard-codes `SPEED_MAX_KMH = 320` and `majorTickStep = 40`, passed to the generic `AnalogGauge`. The gauge already clamps out-of-range needles (`Math.min(1, Math.max(0, …))`), so a dynamic maximum needs no change to the gauge primitive — only to the numbers fed into it.

Top speed is not in AC's UDP protocol (neither the handshake nor RTCarInfo carry it), so the only source is the car's files on disk. AC exposes each car's advertised specs in plaintext at `content/cars/<carName>/ui/ui_car.json`, and the handshake already gives us `carName` (the folder id, e.g. `"abarth500"`). The bridge already reads the AC install for track assets (`trackAssets.ts`), so a car-spec resolver is a direct sibling reusing the same resolved `AC_PATH`.

Investigation of the local 129-car install established the constraints this design must handle:
- ~85% of cars have a numeric `specs.topspeed` (`"211km/h"`); ~13% are placeholders (`"--km/h"`); ~2% omit the key.
- `ui_car.json` files frequently contain raw control characters (e.g. `abarth500` throws `Invalid control character` on `JSON.parse`). Strict JSON parsing is not reliable.
- `specs.topspeed` is free text and may carry a `+` suffix (`"322+km/h"`).

## Goals / Non-Goals

**Goals:**
- Scale the speedometer to the current car so the needle uses most of the dial and rarely pegs.
- Fixed-for-the-session behavior: resolve once when the car is known, never rescale mid-drive.
- Robust fallback to today's 0–320 scale when top speed is unavailable.
- Keep the dial tidy (clean maximum, ~6–8 evenly labeled ticks) for arbitrary top speeds.

**Non-Goals:**
- Touching the RPM/tachometer gauge (its redline lives in the encrypted `data.acd`; out of scope).
- Reading actual drivetrain data (gear ratios, limiter) from `data.acd`.
- Live/adaptive dial scaling or high-water-mark learning (explicitly rejected in favor of a fixed session scale).
- mph handling — treat the value as km/h; AC's field is conventionally km/h and mph mods are rare enough to fall back.

## Decisions

### Resolve on the bridge, carry on the session message
A new `bridge/src/carAssets.ts` (sibling to `trackAssets.ts`) exports `resolveCarTopSpeed(carName): number | null`, reusing the module-resolved `AC_PATH`. `index.ts` calls it in the existing `ac.on('session', …)` handler (right where `resolveTrackAssets` already runs) and adds `topSpeedKmh` to the `SessionInfo` it broadcasts.

**Why here:** top speed is a per-car, session-scoped fact — exactly like `mapAvailable`/`boundsAvailable`. Resolving on the bridge (Node, filesystem access) keeps the web app a pure consumer of the session contract and guarantees the value is fixed for the session. Alternative — exposing an HTTP endpoint the web app fetches — was rejected as more moving parts for a value that belongs on the session message we already send.

`SessionInfo` is hand-mirrored in `bridge/src/types.ts` and `web/src/types.ts`; both gain `topSpeedKmh: number | null`. The field is additive, so older/newer message shapes stay compatible.

### Tolerant extraction, not JSON.parse
`resolveCarTopSpeed` reads the file as text and extracts the top speed by regex rather than parsing JSON, mirroring the codebase's existing stance (`readWideString` cuts garbage in `parsers.ts`; `parseMapIni` regexes lines in `trackAssets.ts`). Approach: locate the `topspeed` field (e.g. `/"topspeed"\s*:\s*"([^"]*)"/`), then pull the first numeric run from its value (`/(\d+)/`). No digits (`"--km/h"`, `"---"`, empty), no field, or no file → `null`. A trailing `+` is naturally ignored because we take the leading digit run.

**Why:** a strict `JSON.parse` throws on real Kunos files (confirmed on `abarth500`). We only need one field, so scanning text for it is both simpler and more robust than sanitizing the whole document.

### Nice-rounding the dial maximum (web side)
`InstrumentCluster` derives the scale from `session.topSpeedKmh`:
1. Apply headroom: `target = topSpeed × 1.08` (advertised top speed is regularly exceeded in-game via drafting/downhill/gearing, so a margin keeps the needle off the stop).
2. Round the maximum up to a clean step so tick labels stay round: round `target` up to the next multiple of a base unit chosen from magnitude (e.g. 20 for typical road cars, 40–50 for fast cars).
3. Derive `majorTickStep` as `dialMax / 8` snapped to a clean value (e.g. 20/25/40/50) so the dial shows ~6–8 labeled ticks and every label is round.

When `topSpeedKmh` is `null`, skip all of the above and use the existing constants (`max 320`, `step 40`) unchanged.

**Why compute on the web side:** the "nice number" math is presentation logic tied to how `AnalogGauge` renders ticks; keeping it next to the gauge (rather than on the bridge) means the wire contract stays a single honest number (`topSpeedKmh`) and the rounding can evolve without a protocol change. A small pure helper (e.g. `speedScale(topSpeedKmh)` returning `{ max, majorTickStep }`) keeps it testable-by-eye and out of the JSX.

### Thread the session into InstrumentCluster
`InstrumentCluster` currently takes only `telemetry`. It will also take `session` (or just the derived `speedMax`/`majorTickStep`). `App.tsx` already holds `session` from `useTelemetry` and renders the cluster inside the `session ? …` branch, so it is in scope — this is a one-line prop addition.

## Risks / Trade-offs

- **Fast/exotic cars are disproportionately placeholders** (the local `F1_redbull_2024` reads `"--km/h"`) → those fall back to 320 and the F1 needle still pegs. Accepted: fallback is the agreed behavior; 320 is no worse than today. A future change could learn top speed live for these.
- **Advertised top speed is a marketing number, not the sim's achievable max** → the ×1.08 headroom absorbs normal overshoot; genuine outliers still clamp (correctly) and the digital readout remains exact. The margin is a tunable constant.
- **mph or oddly-formatted mods** → parsed as if km/h, producing a wrong-but-bounded scale. Rare; acceptable. Could add a `mph` check later.
- **Nice-rounding producing ugly ticks for edge magnitudes** (very low or very high top speeds) → the base-unit/step selection must be validated across the observed range (roughly 150–370 km/h); pick step buckets that stay round throughout.

## Migration Plan

Additive and backward-compatible: a web build without the change ignores the new `topSpeedKmh` field; the bridge change only adds a field. No data migration. Rollback is reverting the commit. Verifiable with `npm run mock -w bridge` (mock reports car `abarth500` → expect a ~211-derived scale) and against the real game across a slow car, a fast car with a spec, and a placeholder car (expect 320 fallback).
