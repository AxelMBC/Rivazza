# Demo recording

`imola.json` is the recorded session replayed when the app is built with
`VITE_DEMO_MODE=1` (see `web/src/lib/demo.ts` and `web/src/hooks/useTelemetry.ts`).

The recorder captures the exact `BridgeMessage` WebSocket stream (`status` /
`session` / `telemetry` / `cut`), so replay is identical to a live session. The
track outline (`map.ini` bounds as `meta`, AI-spline edges as `edges`) travels
inside the recorded `session` message, so the recording is the only file the demo
needs. When the wire format changes shape, regenerate it by re-recording:

1. Start the game (or `npm run mock -w bridge`) and the bridge (`npm run dev`).
2. Drive your laps.
3. Record the live stream:
   ```
   npm run record -w bridge -- --out web/public/demo/imola.json --duration 180
   ```
   (or omit `--duration` and stop with Ctrl-C when done).
4. Commit the new `imola.json`.
