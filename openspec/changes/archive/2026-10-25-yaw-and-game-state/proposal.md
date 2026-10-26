## Why

The track-map wedge guesses the car's heading from its last positions, because the UDP protocol carries no yaw. So it points
the wrong way in a drift or in reverse, and shows a plain circle until the car moves. The bridge also cannot tell a paused
game from a live one. AC keeps streaming identical UDP frames while paused, and the bridge relays them at 60 Hz for nothing.
What AC sends during a replay is unknown, and replayed laps could pass for a session restart and wipe the lap log. Both facts
already sit in the shared-memory pages the bridge maps on Windows: `heading` on the physics page, `status` on the graphics page.

## What Changes

- The bridge stamps each telemetry frame with the car's yaw, read from the physics page (`heading`, offset 208). The
  track-map wedge points where the car faces. Where shared memory is unavailable, it falls back to today's motion-derived
  heading.
- The bridge reads the game's run state from the graphics page (`status`, offset 4: off, replay, live, pause):
  - While the game is paused or in a replay, it drops telemetry frames and suppresses cut onsets.
  - It reports the state on the `status` message, and the connection badge reads "Paused" or "In replay".
  - Pause and replay never let the stale-telemetry timeout end the session.
  - A switch to off ends the session at once, without waiting the 5 s timeout.
- The physics mapping is opened once, in one shared place, for cut detection and the yaw reader alike.
- The mock writes the graphics page and a yaw, and periodically simulates a pause and a replay.
- Both wire additions are optional fields (`TelemetryFrame.heading`, `status.game`), so `PROTOCOL_VERSION` stays at 1 and
  the committed demo recording stays valid.

## Capabilities

### New Capabilities

- `game-state`: the bridge reads AC's run state from the graphics page. It holds frames while paused or in a replay,
  reports the state on `status`, keeps the session through pause and replay, and ends it promptly on off. The dashboard
  badge shows the state, and the mock simulates it.

### Modified Capabilities

- `car-heading-marker`: the wedge follows the car's yaw when the frame carries one. Motion-derived heading becomes the
  fallback, and the plain-circle fallback applies only when neither is available. A new requirement covers the bridge
  stamping the yaw.
- `cut-detection`: onsets are also suppressed while the game is paused or in a replay. The mock's physics page also
  carries a yaw and freezes during a simulated pause.

## Out of Scope

- Moving the frame source to shared memory: UDP stays the telemetry source and the broadcast clock.
- Any other shared-memory field (max RPM, tyre temperatures, fuel, sectors, session type, performance meter).
- Showing a replay on the dashboard: replay frames are dropped, not displayed.
- Re-recording the demo: the committed recording keeps the motion-derived wedge.

## Impact

- `packages/protocol/src/index.ts`: `GameState`, optional `status.game`, optional `TelemetryFrame.heading`.
- `bridge/src/shm/`: a shared lazily-mapped page helper, a graphics-page game-state reader and watcher, a yaw reader.
  `cutDetection.ts` uses the shared physics page.
- `bridge/src/udp/acClient.ts` (session hold and immediate end), `bridge/src/session.ts` (greeting carries the game state)
  and `bridge/src/index.ts` (wiring).
- `bridge/scripts/mock-ac.js`.
- `web/src/hooks/useTelemetry.ts`, `web/src/components/SessionHeader/ConnectionBadge.tsx` and
  `web/src/components/TrackMap/markers.ts`.
- No new dependency. Windows-only like cut detection: everywhere else the dashboard behaves exactly as today.
