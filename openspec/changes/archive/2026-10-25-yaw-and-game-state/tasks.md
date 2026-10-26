# Read the car's yaw and the game's pause/replay/off state from AC's shared memory

## 1. Wire contract

- [x] 1.1 In `packages/protocol/src/index.ts`, add `GameState` (`"live" | "paused" | "replay"`), an optional `game` on the connected `status` message, and an optional `heading` (radians) on `TelemetryFrame`; leave `PROTOCOL_VERSION` at 1

## 2. Bridge: shared-memory readers

- [x] 2.1 Add a lazily-mapped page helper in `bridge/src/shm/`. It maps a named page on demand, retries every ~3 s, logs availability once, and its read reports failure while unmapped. Move `cutDetection.ts`'s own open/retry/log loop onto it, with no change in cut behaviour
- [x] 2.2 Add the yaw reader: float32 at physics offset 208, or nothing when the page is unreadable
- [x] 2.3 Add the graphics-page reader: `packetId` @0 and `status` @4, mapped to off, replay, live or paused, or unknown when unreadable
- [x] 2.4 Write the pure watch step: given `(packetId, status, now)`, it returns the state, change events, freshness (`packetId` advanced within ~2 s), the session-hold predicate, and the off-ends-session rule, which requires a non-off state with an advancing `packetId` earlier in the same session. Put a `node:test` file beside it covering pause, resume, replay, a stale page, a crash frozen at live, and off after a new session's loading
- [x] 2.5 Poll the graphics page at ~10 Hz (an interval of 100 ms) through the step

## 3. Bridge: wiring

- [x] 3.1 In `ACClient`, add an optional `holdSession` predicate, consulted when the stale timer fires (re-arm instead of dropping), and a public `endSession()` that takes the stale timeout's path
- [x] 3.2 Make `session.ts`'s connected greeting carry the current `game` when known
- [x] 3.3 In `index.ts`:
  - judge each arriving frame by a fresh graphics read, and push only when the state is live or unknown
  - suppress cut onsets while paused or in a replay
  - stamp `heading` in the throttle's send callback
  - broadcast a connected `status` with `game` on every change during a live session
  - call `ac.endSession()` when the step's off rule fires
  - pass the step's hold predicate to `ACClient`

## 4. Mock

- [x] 4.1 Create and write `Local\acpmf_graphics` in `bridge/scripts/mock-ac.js`, with `packetId` advancing every tick and the current `status`
- [x] 4.2 Write the physics `heading` at offset 208 from the mock ellipse's direction of travel, using the inverse of the web's yaw conversion
- [x] 4.3 Every couple of minutes, alternately simulate a few seconds of pause and a few seconds of replay, logging each transition:
  - pause: the clock and physics `packetId` freeze, the frame is still sent, and `status` is 3
  - replay: `status` is 1 and frames come from an earlier point of the lap

## 5. Web

- [x] 5.1 In `useTelemetry`, map a connected `status`'s `game` to `ConnectionStatus` `"paused"` or `"replay"` (a missing `game` means live), without clearing the session or the frame
- [x] 5.2 In `ConnectionBadge`, show "Paused" with a steady `warning` dot and "In replay" with an `accent` dot
- [x] 5.3 In `TrackMap/markers.ts`, when `frame.heading` is present, set the wedge angle from projecting the position and a point ~1 m ahead along the yaw's forward vector, with the yaw→forward conversion in one named function. Keep the motion anchors tracking every frame as the fallback. Draw the circle only when neither source has a heading

## 6. Docs

- [x] 6.1 Update the Purpose paragraph of `openspec/specs/car-heading-marker/spec.md`: the heading is the car's yaw, and motion-derived heading is the fallback
- [x] 6.2 In `CLAUDE.md`, update the "Session lifecycle" and "Cut detection" paragraphs: the graphics-page game state, the frame gate, the session hold, off ending a session, the yaw stamp and the shared page helper

## 7. Verification

- [x] 7.1 Run `/axl:verify`
- [x] 7.2 In AC, drive forward along a straight, then reverse a few meters: the wedge points out of the car's nose both times, not along its motion when reversing. If it points 90° off or mirrored, the yaw conversion needs its sign or offset fixed
- [x] 7.3 In AC, pause (Esc) for over 10 s and resume: the badge reads "Paused" during the pause, the gauges freeze, and the session and laps stay; after resuming it reads "Live" and the gauges move again
- [x] 7.4 In AC, open a replay from the pause menu, watch it for over 10 s, and go back: the badge reads "In replay" meanwhile, no lap is added or wiped, and the session stays
- [x] 7.5 In AC, quit the session to the menu: the dashboard switches to "Waiting for game" within about a second instead of ~5 s
