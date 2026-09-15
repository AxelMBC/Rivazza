# Demo assets

`imola.map.json` is the `{ meta, edges }` payload the demo build serves in place of
`/api/track-map/meta` and `/api/track-map/edges`. It is a snapshot of the track assets
the bridge resolves from an AC install, so **it goes stale whenever `TrackEdges`
changes shape** — a missing field silently costs the demo a feature (the sector
division reads `edges.pos`). Regenerating needs only the AC install, not a running
game or session:

```ts
import { resolveTrackAssets } from "./bridge/src/trackAssets.js";
const a = resolveTrackAssets("imola", null);
fs.writeFileSync("web/public/demo/imola.map.json",
  JSON.stringify({ meta: a.meta, edges: a.edges }));
```

Run it with `npx tsx`, then commit the result.

# Demo recording

`imola.json` is the recorded session replayed when the app is built with
`VITE_DEMO_MODE=1` (see `web/src/lib/demo.ts` and `web/src/hooks/useTelemetry.ts`).

## ⚠️ Current file is a placeholder

The committed `imola.json` is currently an **8‑second Magione mock capture**, only
so the demo build runs out of the box. Replace it with real Imola laps:

1. Start the game (or `npm run mock -w bridge`) and the bridge (`npm run dev`).
2. Drive your laps.
3. Record the live stream:
   ```
   npm run record -w bridge -- --out web/public/demo/imola.json --duration 180
   ```
   (or omit `--duration` and stop with Ctrl-C when done).
4. Commit the new `imola.json`.

The recorder captures the exact `BridgeMessage` WebSocket stream (`status` /
`session` / `telemetry` / `cut`), so replay is identical to a live session.
