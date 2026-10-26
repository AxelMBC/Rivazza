## Context

UDP is the telemetry source and the broadcast clock. `frameThrottle.ts` flushes on packet arrival because Windows' ~15.6 ms
timer tick caps a pure timer at ~64 Hz. Shared memory is already read on Windows. `cutDetection.ts` maps
`Local\acpmf_physics` with its own open/retry/log-once loop and polls it at ~64 Hz. `staticPage.ts` maps
`Local\acpmf_static` once per session. Both degrade silently through `kernel32.ts` (`SHM_STATE`, koffi load failure).

Facts this design rests on:

- **Pause.** While paused, AC keeps streaming RTCarInfo over UDP: the user reports the dashboard stays "Live". The bridge
  therefore relays identical frames at 60 Hz, and the web re-renders at 30 Hz, for nothing.
- **Replay.** AC's UDP behaviour during a replay is unknown. It may stream replayed frames, or stop. If it streams them,
  the lap counter and clock run backwards, and `classifyLapTransition` reads that as a session restart and discards the lap
  log.
- **Graphics page.** `SPageFileGraphic` starts with `int packetId` at 0 and `int status` at 4 (`AC_OFF` 0, `AC_REPLAY` 1,
  `AC_LIVE` 2, `AC_PAUSE` 3).
- **Physics page.** `heading` is the float at offset 208. Every member from 0 to 244 is a 4-byte scalar or float array,
  and the offsets 28 and 244 the cut detector already uses confirm the layout.
- **Yaw convention.** AC does not document its yaw convention: zero direction and turning sense are unknown.

## Goals / Non-Goals

**Goals:**

- The wedge shows the car's true orientation wherever shared memory is readable.
- Pause and replay never relay frames, never feed the lap log and never end the session.
- Off ends the session promptly.
- Wherever shared memory is unreadable, everything behaves exactly as today.

**Non-Goals:**

- Shared memory as the frame source.
- Any other shared-memory field.
- Displaying replays.
- A protocol version bump.

## Decisions

### 1. Shared memory complements UDP; it never replaces it

```
AC ──UDP──▶ ACClient ──push──▶ [gate: graphics status read now] ──▶ throttle ──flush──▶ + heading (physics @208) ──▶ WS
                ▲                                                                                         
                │ holdSession() / endSession()                                                             
      game-state watch (graphics page, ~10 Hz) ──change──▶ status { connected, game } ──▶ WS
```

UDP keeps the clock and the consistent snapshot. Shared memory adds two facts the protocol lacks. A full migration loses
on the timer cap, on torn cross-page reads and on remote/non-Windows support (explored before this proposal).

### 2. `game` is an optional field on `status`; `heading` is an optional field on `TelemetryFrame`

The game state rides on the connected `status` message, rebroadcast on change. It beat two alternatives:

- **A new `game` message variant.** The rule beside `PROTOCOL_VERSION` makes that a bump, and a bump makes the web refuse
  the committed demo recording (protocol 1) until it is re-recorded.
- **A field on every telemetry frame.** Frames are exactly what stops flowing in pause, so that field could never say
  "paused".

Both optional fields need no bump. A peer that ignores them gets today's behaviour, and the demo recording stays valid.

On the web, `ConnectionStatus` gains `"paused"` and `"replay"`. The badge is that type's one renderer, and `App` keys its
screens on `session`, not on `"connected"`, so the new values show the dashboard.

### 3. Gate frames in the bridge, judged at arrival

Dropping frames in the bridge removes the JSON encode, the WebSocket traffic and the 30 Hz React re-renders for the whole
pause, and keeps replay frames from ever reaching lap logic. A web-side gate would pay all of that and need every consumer
to check.

Each frame is judged by an 8-byte read of the graphics page as it arrives (one FFI call, about a microsecond), not by the
~10 Hz watch. A frame arriving up to 100 ms after the replay began could otherwise slip through and wipe the lap log.
Unknown state gates nothing.

### 4. A pure watch step owns freshness, change detection, the session hold and the off rule

The ~10 Hz poll feeds `(packetId, status, now)` to a pure step function, unit-tested like `stepLapLog`. It returns the
known/unknown state, change events, whether the page is fresh (`packetId` advanced within ~2 s) and whether an off
transition should end the session.

The off rule requires a non-off state with an advancing `packetId` earlier in the same session. The bridge keeps its
mapping handle open, so after AC exits the page survives with its last contents, and a new run may write off while
loading.

`ACClient` gains a `holdSession` predicate, consulted when its stale timer fires (re-arm instead of dropping), and an
`endSession()` that takes the same path as the stale timeout. The 5 s timeout stays the backstop.

### 5. Yaw is read at flush and converted in the web by projecting two world points

The bridge reads `heading` in the throttle's send callback: at most 60 reads a second, no new timer, and the freshest
value at send time. It sends AC's raw radians.

The web turns the yaw into a world-space forward vector in one function, then projects the car's position and a point
~1 m ahead of it. This is the same two-point technique the motion anchors use, so the wedge is mirror-immune in every
projection mode. The motion anchors keep tracking every frame, so a source without yaw falls back seamlessly.

### 6. One lazily-mapped page helper in `bridge/src/shm/`

The physics page now has two consumers (cut detection and the yaw reader), and the graphics page has two (the watch and
the arrival gate). The open / retry-every-3-s / log-once loop moves out of `cutDetection.ts` into a helper that maps a
named page on demand and reports a failed read while unmapped. `index.ts` creates one helper per page and hands it to each
consumer. `staticPage.ts` keeps its one-shot read.

### 7. The mock simulates the worst case

The mock's simulated replay streams rewound frames with status replay: the case that would wipe the lap log if the gate
failed, so a broken gate is visible at once. Its pause freezes its clock and physics `packetId` while UDP keeps streaming,
matching what AC does.

## Risks / Trade-offs

- **Yaw convention guessed wrong.** The wedge would point 90° off or mirrored. → The conversion is one function. The
  first manual check (drive a straight, then reverse) shows any error at once, and the fix is a sign or an offset.
- **AC's ordering between the replay status flip and its first replay UDP frame is unknown.** → Judging at arrival leaves
  only that window. If a manual replay check still loses laps, the follow-up is to also hold frames for a short time after
  any non-live state.
- **The graphics `packetId` may not advance while paused or in a replay.** → The session hold then never applies, and
  sessions end as today. Pause already keeps UDP flowing, so only a long replay without UDP would still drop the session.
- **The `game` field is recorded into future demo recordings.** → The demo build suppresses the connection badge, so a
  recorded "Paused" changes nothing visible.

## Open Questions

- AC's yaw convention: settled by the first manual check, then fixed in the conversion function and in the mock.
- Whether AC streams UDP during a replay: the design handles both cases, and the replay manual check tells which one
  holds.
