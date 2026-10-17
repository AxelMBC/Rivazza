import type { BridgeMessage, SessionInfo } from "@rivazza/protocol";
import { WebSocket, WebSocketServer } from "ws";

import { resolveCarTopSpeed } from "./content/carAssets.js";
import {
  resolveTrackAssetsForSession,
  type TrackAssets,
} from "./content/trackAssets.js";
import { createFrameThrottle } from "./frameThrottle.js";
import { startCutDetection } from "./shm/cutDetection.js";
import { ACClient } from "./udp/acClient.js";

const PORT = Number(process.env.BRIDGE_PORT ?? 3001);
const BROADCAST_HZ = 60;
const BROADCAST_INTERVAL_MS = 1000 / BROADCAST_HZ;

let session: SessionInfo | null = null;
let sessionGeneration = 0;

const wss = new WebSocketServer({ port: PORT, path: "/ws" });

wss.on("error", (err) => {
  console.error(`[bridge] cannot serve on port ${PORT}:`, err.message);
  process.exit(1);
});

const broadcast = (message: BridgeMessage): void => {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
};

const throttle = createFrameThrottle(BROADCAST_INTERVAL_MS, (frame) =>
  broadcast({ type: "telemetry", ...frame }),
);

wss.on("connection", (socket) => {
  socket.on("error", () => socket.terminate());
  const hello: BridgeMessage[] = session
    ? [
        { type: "status", state: "connected" },
        { type: "session", ...session },
      ]
    : [{ type: "status", state: "waiting" }];
  for (const message of hello) socket.send(JSON.stringify(message));
});

const ac = new ACClient();

ac.on("session", async (handshake) => {
  const generation = ++sessionGeneration;
  let assets: TrackAssets | null = null;
  try {
    assets = await resolveTrackAssetsForSession(
      handshake.trackName,
      handshake.trackConfig,
    );
  } catch (err) {
    console.warn(
      "[map] track asset resolution failed:",
      err instanceof Error ? err.message : String(err),
    );
  }
  if (generation !== sessionGeneration) return;
  session = {
    track: handshake.trackName,
    trackConfig: handshake.trackConfig,
    car: handshake.carName,
    driver: handshake.driverName,
    meta: assets?.meta ?? null,
    edges: assets?.edges ?? null,
    topSpeedKmh: resolveCarTopSpeed(handshake.carName),
  };
  broadcast({ type: "status", state: "connected" });
  broadcast({ type: "session", ...session });
});

ac.on("waiting", () => {
  sessionGeneration++;
  session = null;
  throttle.clear();
  broadcast({ type: "status", state: "waiting" });
});

ac.on("telemetry", throttle.push);

const stopCutDetection = startCutDetection({
  getFrame: throttle.latest,
  isLive: () => session !== null,
  onCut: (cut) => {
    console.log(
      `[shm] cut: ${cut.tyresOut} tyres out on lap ${cut.lapCount + 1} at (${cut.x.toFixed(1)}, ${cut.z.toFixed(1)})`,
    );
    broadcast({ type: "cut", ...cut });
  },
});

wss.on("listening", () => {
  console.log(`[bridge] ws listening on ws://localhost:${PORT}/ws`);
  ac.start();
});

const shutdown = (): void => {
  stopCutDetection();
  throttle.stop();
  ac.stop();
  wss.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
