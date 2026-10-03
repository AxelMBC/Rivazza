## Context

`TelemetryFrame.tyreSlip` is read from RTCarInfo offset 148 and is always zero. In the committed
Imola recording, all 26,345 telemetry frames read zero on every wheel, including the 1,187 frames
where `tcInAction` was true. The only consumer is the hover `TyreOverlay`, which grades that zero
against guessed thresholds (1 / 3). The mock writes no slip at all, so nothing in the repo has ever
shown a non-zero value.

AC exposes slip in other places that the bridge doesn't read today:

```
RTCarInfo (UDP, every platform, reaches recordings and remote AC_HOST)
  @100 slipAngle[4]     lateral, radians-ish
  @132 slipRatio[4]     longitudinal (wheelspin / lock-up)
  @148 tyreSlip[4]      ← parsed today, always 0
  @164 ndSlip[4]        normalised slip, ~1 at the grip peak
SPageFilePhysics (shared memory, Windows + same PC, already mapped for cut detection)
  @56  wheelSlip[4]     combined slip per wheel
```

Any UDP block could be dead in the same way @148 is. Only the real game can tell, and the mock
can't, because it writes whatever we tell it to.

## Goals / Non-Goals

**Goals:**
- A per-wheel "this tyre has let go" signal, glanceable mid-corner, from data AC actually fills.
- `tyreSlip` that distinguishes "no data" (`null`) from "no slip" (`0`).
- Zero cost to the canvas paths: no new rAF consumer, no new dirty-gate term.

**Non-Goals:**
- Oversteer / understeer classification, slip angle in degrees, or any car-level drift metric.
- Recording slip into lap history or marking slip spots on the track map (a possible follow-up,
  using the cut-marker pattern).
- Re-recording `imola.json`. The demo's lamps stay dark until someone records a new session on the
  game PC.

## Decisions

### D1. Spike before committing to a source

Task 1 runs a throwaway logger (in the scratchpad, not committed) against the real game. It prints the
four UDP blocks and SHM @56 while the driver (a) cruises, (b) spins the rears on exit, (c) locks the
fronts under braking. The first source that shows clear per-wheel excursions wins, in this order:

1. **UDP `ndSlip` @164**: normalised slip, so the threshold has a physical meaning (~1 = past
   peak grip), and it reaches every platform, the demo recorder and remote hosts.
2. **UDP `slipRatio` @132**: same reach, but longitudinal only: it shows wheelspin and lock-up and
   misses a pure lateral slide. Acceptable if `ndSlip` is dead.
3. **SHM `wheelSlip` @56**: combined slip, reliably filled, but Windows + same PC only.

The result (source, offset, observed baseline and excursion magnitudes) is written into this file
under "Spike outcome" before task 2 starts. *Alternative rejected:* committing to SHM now. It is
almost certainly live, but it gives up demo and remote reach that a 10-minute test could keep.

### D2. Keep the field name `tyreSlip`, make it nullable (revised by the spike outcome: not nullable)

`tyreSlip: number[] | null` in `@rivazza/protocol`. Renaming it to `wheelSlip` or `slipRatio` would tie the
wire name to the spike's outcome. The meaning is "per-wheel slip magnitude", whatever the source.
Values are `Math.abs`'d in the bridge so the web never deals with sign conventions.
*Alternative rejected:* a separate `slipAvailable: boolean`. Two fields can disagree, and a
nullable one can't.

### D3. Shared-memory outcome: one poll loop, merged at broadcast (not taken, see spike outcome)

If SHM wins, `startCutDetection`'s existing ~60 Hz poll also reads `wheelSlip` on each fresh
`packetId` and keeps the newest four values. The module exposes them through a getter that returns
`null` when the page is unmapped or `packetId` hasn't advanced for a short stale window. `index.ts` sets
`tyreSlip` from that getter inside the throttle's send callback, so the merge happens exactly at
broadcast and the recorder captures it.

```
UDP ─▶ parseRTCarInfo (tyreSlip: null) ─▶ throttle ─▶ send(frame) ─┬▶ WS
SHM ─▶ poll (cut onset + wheelSlip)  ──── latestWheelSlip() ───────┘
```

The poller then serves two features, so it gets renamed to something like `startPhysicsPoller` with the
cut detector as one consumer. The `cut-detection` delta (task 1.4) records that the page is now also
read at @56 and that degradation covers slip. *Alternative rejected:* a second mapping/poll loop
for slip. That doubles the FFI copies for the same page.

If UDP wins, none of this applies: `parsers.ts` reads the chosen offset instead of 148 and
`tyreSlip` is never `null` while a session streams.

### D4. Lamps are React, with hysteresis held in a small hook

The lamps read the ~30 Hz `telemetry` state like the other `StatusLight`s. That rate is plenty for
a light, and the `telemetryRef` path is for rAF canvases. Lit state needs the previous lit
state (on above `SLIP_ON`, off below `SLIP_OFF`), so a `useWheelSlipLamps(telemetry)` hook keeps
a `boolean[4]` in state. It derives the next lamps during render (React's "state from the previous
render" pattern, which avoids an effect's extra commit) and sets state only when a wheel crosses a
threshold. Re-renders follow
lamp transitions, not frames. `SLIP_ON` / `SLIP_OFF` are named constants, calibrated from the spike's
numbers, and shared with `TyreOverlay`'s warning grade so the two never disagree.

Layout: a 2×2 block between the ABS/TC row and PIT in the existing `grid-cols-2` light group,
reusing `StatusLight` with `activeClass="bg-warning"` and labels FL/FR/RL/RR. `enabled` is
`telemetry !== null`, so the lamps are muted before the first frame.

*Alternative rejected:* the centre of the G-force meter. It's hidden when `DriverInputs` is
under 160 px tall, and it would add slip as a repaint input to a dirty-gated canvas.

## Risks / Trade-offs

- [Every UDP block is dead and SHM wins] → The lamps work only on the game PC; demo and remote
  show the muted state. That's still honest, and it's the same reach cut detection has today.
- [Thresholds from one car don't fit another] → `ndSlip` (if live) is normalised, so this mostly goes
  away. For raw sources, calibrate on a high-grip and a low-grip car during the spike and pick
  conservatively.
- [`tyreSlip` becoming nullable breaks a consumer] → The only consumer is `TyreOverlay`, updated
  in the same change. `tsc` over both workspaces catches anything missed.
- [Lamps chatter at the limit] → Hysteresis (D4). If it still reads as noise, add a short hold
  time in the hook. No spec change is needed, since the spec only requires that it doesn't flicker.

## Spike outcome

One car, 64 s at up to 218 km/h, with drifting, wheelspin and hard braking (TC fired in 512 frames):

```
moving >20 km/h      nonzero   p50     p90     p99      max
tyreSlip  @148         0%      0       0       0        0          dead, as in imola.json
ndSlip    @164        99%      0.59   14.2    ~1e6     1.17e6     live
SHM wheelSlip @56     99%      ≡ ndSlip frame for frame
slipRatio @132        99%      ±1.00 at a locked wheel, longitudinal only
slipAngle @100        99%      degrees, up to 85 in a drift
```

`ndSlip` by situation: straight ~0.05–0.3 · cornering at the limit ~0.6–1.0 · slide or drift
1.5–15 · front lock-up under braking 1e3–1.2e6 (the wheel stops, and the normalisation divides
by ~0).

**Decision: UDP `ndSlip` @164** (D1 step 1). The shared-memory branch (D3) and task 1.4 don't
apply. That changes two things:

- **D2 is revised: `tyreSlip` stays `number[]`, not nullable.** A UDP source is live whenever
  frames arrive, so `null` would never be sent by a live bridge. The only frames without real slip
  are old recordings, which carry `[0,0,0,0]` either way. Their lamps stay dark, which is correct
  for "no slip seen".
- **The bridge caps each value at `SLIP_CAP = 50`** (and maps a non-finite value to the cap).
  `JSON.stringify` turns `Infinity`/`NaN` into `null`, which would break `number[]` on the wire,
  and nothing downstream needs to tell 50 from a million.

Thresholds: `SLIP_ON = 1.2`, `SLIP_OFF = 0.9` (just past the ~1.0 grip peak, with the off point
below the cornering-at-the-limit band so a lamp clears on corner exit). The overlay's critical
grade is `3`, in the middle of the slide band. Only one car was logged. `ndSlip` is normalised,
so it should carry across cars, but 4.5 confirms it on a second car.
