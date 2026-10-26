import type { BridgeMessage } from "@rivazza/protocol";
import { WebSocket, WebSocketServer } from "ws";

import { createFrameThrottle } from "./frameThrottle.js";
import { createSession } from "./session.js";
import { startCutDetection } from "./shm/cutDetection.js";
import {
  createGraphicsReader,
  isHeldState,
  startGameWatch,
} from "./shm/gameState.js";
import { createLazyPage } from "./shm/lazyPage.js";
import { readStaticPageTokens } from "./shm/staticPage.js";
import { createYawReader } from "./shm/yaw.js";
import { ACClient } from "./udp/acClient.js";

const PORT = Number(process.env.BRIDGE_PORT ?? 3001);
const BROADCAST_HZ = 60;
const BROADCAST_INTERVAL_MS = 1000 / BROADCAST_HZ;

const physicsPage = createLazyPage("physics");
const graphicsPage = createLazyPage("graphics");
const readYaw = createYawReader(physicsPage);
const readGraphics = createGraphicsReader(graphicsPage);
const isGameHeld = (): boolean => isHeldState(readGraphics()?.state);

const session = createSession(readStaticPageTokens, () => gameWatch.game());

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
  broadcast({ type: "telemetry", ...frame, heading: readYaw() }),
);

wss.on("connection", (socket) => {
  socket.on("error", () => socket.terminate());
  for (const message of session.greeting())
    socket.send(JSON.stringify(message));
});

const gameWatch = startGameWatch({
  read: readGraphics,
  isLive: session.isLive,
  onChange: (game) => {
    console.log(`[shm] game ${game ?? "off"}`);
    if (session.isLive()) broadcast(session.status());
  },
  onOff: () => ac.endSession(),
});

const ac = new ACClient({ holdSession: gameWatch.holdsSession });

ac.on("session", async (handshake) => {
  if (!(await session.start(handshake))) return;
  for (const message of session.greeting()) broadcast(message);
});

ac.on("waiting", () => {
  session.end();
  throttle.clear();
  for (const message of session.greeting()) broadcast(message);
});

ac.on("telemetry", (frame) => {
  if (session.isLive() && !isGameHeld()) throttle.push(frame);
});

const stopCutDetection = startCutDetection({
  physics: physicsPage,
  isHeld: isGameHeld,
  getFrame: throttle.latest,
  isLive: session.isLive,
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
  gameWatch.stop();
  physicsPage.close();
  graphicsPage.close();
  throttle.stop();
  ac.stop();
  wss.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
