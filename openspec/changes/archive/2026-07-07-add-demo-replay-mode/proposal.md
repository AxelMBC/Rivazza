## Why

The dashboard only works with a live bridge (UDP + WebSocket + AC shared memory) running on the same machine as the game — none of which can run on a static host like Vercel. To publish a public demo of how the dashboard behaves, the web app needs to replay a real recorded session instead of connecting to a bridge, so a few laps of Imola can be shown to anyone with a URL and no game, no bridge, and no install.

## What Changes

- Add a **recorder**: a small bridge-side WebSocket client (run alongside a real driving session) that captures every `BridgeMessage` with an arrival timestamp and writes them to a single JSON recording file (`status` | `session` | `telemetry` | `cut` — the exact wire stream the web app already consumes).
- Record ~3 laps of Imola and commit the recording as a static asset under `web/public/demo/`.
- Add a **replay path** to `useTelemetry`: when demo mode is active, the hook does not open a WebSocket; it fetches the recording, replays frames respecting original inter-frame timing, loops at the end, and never attempts reconnection.
- Gate demo mode behind a **Vite build-time flag** (`VITE_DEMO_MODE`) — not a runtime env var (the SPA has no server) and not a dedicated branch (which would rot against `master`). Local `npm run dev` remains unchanged (live bridge); Vercel builds with the flag set.
- Show a small, non-intrusive "Demo" indicator in the UI while replaying so viewers know the data is recorded, not live.

## Capabilities

### New Capabilities
- `demo-replay`: Recording a live `BridgeMessage` stream to a static file, and a build-time-gated replay mode in the web app that feeds that recording into the existing telemetry data flow (in place of the WebSocket) with faithful timing, looping, and a demo indicator.

### Modified Capabilities
<!-- None. Demo mode is an alternative data source into the existing BridgeMessage
     stream; no existing spec's requirements change. The recorder and replayer
     consume/produce the same wire contract the dashboard already relies on. -->

## Impact

- **New (bridge):** a recorder script (e.g. `bridge/src/record.ts`) plus an npm script to run it; connects as a plain WS client, no changes to the bridge's UDP/serving path.
- **New (web asset):** `web/public/demo/imola.json` (the committed recording), served statically by Vercel.
- **Modified (web):** `web/src/hooks/useTelemetry.ts` gains a replay branch guarded by `import.meta.env.VITE_DEMO_MODE`; a small demo indicator component/flag surfaces in the dashboard.
- **Config/deploy:** `VITE_DEMO_MODE` documented for Vercel; no change to the wire `BridgeMessage` union or `types.ts` contract.
- **No impact** to live operation: without the flag, behavior is byte-for-byte what it is today.
