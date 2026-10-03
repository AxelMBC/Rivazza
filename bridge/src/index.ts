import type { BridgeMessage, SessionInfo } from "@rivazza/protocol";
import { WebSocket, WebSocketServer } from "ws";

import { resolveCarTopSpeed } from "./content/carAssets.js";
import {
  resolveTrackAssetsForSession,
  type TrackAssets,
} from "./content/trackAssets.js";
import { createFrameThrottle } from "./frameThrottle.js";
import { startCutDetection } from "./shm/sharedMemory.js";
import { createTrackAssetServer } from "./trackAssetServer.js";
import { ACClient } from "./udp/acClient.js";

const PORT = Number(process.env.BRIDGE_PORT ?? 3001);
const BROADCAST_HZ = 60;
const BROADCAST_INTERVAL_MS = 1000 / BROADCAST_HZ;

let session: SessionInfo | null = null;
let trackAssets: TrackAssets | null = null;

const server = createTrackAssetServer(() => trackAssets);

const wss = new WebSocketServer({ server, path: "/ws" });

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
  try {
    trackAssets = await resolveTrackAssetsForSession(
      handshake.trackName,
      handshake.trackConfig,
    );
  } catch (err) {
    console.warn(
      "[map] track asset resolution failed:",
      (err as Error).message,
    );
    trackAssets = null;
  }
  session = {
    track: handshake.trackName,
    trackConfig: handshake.trackConfig,
    car: handshake.carName,
    driver: handshake.driverName,
    mapAvailable: trackAssets?.mapImagePath != null,
    boundsAvailable: trackAssets?.meta != null,
    edgesAvailable: trackAssets?.edges != null,
    topSpeedKmh: resolveCarTopSpeed(handshake.carName),
  };
  broadcast({ type: "status", state: "connected" });
  broadcast({ type: "session", ...session });
});

ac.on("waiting", () => {
  session = null;
  trackAssets = null;
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

server.listen(PORT, () => {
  console.log(`[bridge] http + ws listening on http://localhost:${PORT}`);
  ac.start();
});

const shutdown = (): void => {
  stopCutDetection();
  throttle.stop();
  ac.stop();
  server.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
