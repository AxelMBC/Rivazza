## 1. Recorder (bridge)

- [x] 1.1 Add `bridge/src/record.ts`: a WebSocket client that connects to the bridge (`ws://<host>:<BRIDGE_PORT>/ws`), appends each received `BridgeMessage` as `{ t, msg }` (relative ms since first message + verbatim message), and writes compact JSON to an output path on exit/interval
- [x] 1.2 Add an npm script (e.g. `record` in `bridge`) to run the recorder, with configurable output path and host/port via env or args
- [x] 1.3 Verify capture against `npm run mock` (no bridge changes): recording contains `status`/`session`/`telemetry`/`cut` entries in arrival order with monotonic relative timestamps

## 2. Replay path (web)

- [x] 2.1 Add a `VITE_DEMO_MODE` guard in `useTelemetry` (`import.meta.env`): when falsy, take the existing WebSocket path unchanged
- [x] 2.2 Implement the demo branch: `fetch` the recording from the public path, schedule emissions honoring recorded inter-frame deltas (drift-corrected against wall clock), and route them through the same sinks (`setStatus`, `setSession`, `setTelemetry`+`telemetryRef`, `cutsRef`+`setCutSeq`)
- [x] 2.3 Implement seamless looping: on reaching the final message, reset session-scoped state via the existing `clearFrame()` semantics and restart the sequence
- [x] 2.4 Ensure the demo branch never opens a WebSocket and never schedules a reconnect timer; clean up timers on unmount

## 3. Demo indicator (web)

- [x] 3.1 Add a small non-intrusive "Demo" badge rendered only when `VITE_DEMO_MODE` is truthy
- [x] 3.2 Confirm the badge is absent in a normal (non-demo) build

## 4. Recording asset

- [x] 4.1 Record ~3 laps of Imola with the recorder against the real game  _(recorded real Imola laps — f1_redbull_2024, ~1.3 laps)_
- [x] 4.2 Save/minify the recording to `web/public/demo/imola.json` and commit it  _(plus the `imola.map.json` track outline the recorder now captures)_
- [x] 4.3 Verify a local demo build (`VITE_DEMO_MODE=1 npm run dev -w web`) replays the recording with gauges, lap history, track map, and cut markers all rendering  _(confirmed in browser: Demo badge, full Imola track ribbon, lap replays and loops)_

## 5. Deploy & docs

- [x] 5.1 Configure Vercel: build the `web` workspace with `VITE_DEMO_MODE=1`; document root/build/output settings  _(`vercel.json` pins build/output and bakes the flag — no dashboard env var needed)_
- [x] 5.2 Document the record → commit → deploy flow and the re-record step in the README (and note it complements `npm run mock`)
- [ ] 5.3 Verify the deployed Vercel URL replays end to end with no bridge, and confirm a normal build/local dev is byte-for-byte unchanged  _(YOU — after importing the repo on Vercel)_
