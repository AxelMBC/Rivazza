import fs from 'node:fs';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { ACClient } from './acClient.js';
import { startCutDetection } from './sharedMemory.js';
import { resolveTrackAssets, type TrackAssets } from './trackAssets.js';
import { resolveCarTopSpeed } from './carAssets.js';
import type { BridgeMessage, SessionInfo, TelemetryFrame } from './types.js';

const PORT = Number(process.env.BRIDGE_PORT ?? 3001);
// 60 Hz keeps frame spacing near 1 m even at top speed, so the track map's
// meter-scale line sampling holds everywhere on track. Windows quantizes
// short timers to ~15.6 ms ticks (a bare 60 Hz setInterval fires at ~32 Hz),
// so delivery is driven by packet arrival against a due-time accumulator and
// the interval below only sweeps up the trailing frame when packets pause.
const BROADCAST_HZ = 60;
const BROADCAST_INTERVAL_MS = 1000 / BROADCAST_HZ;

let session: SessionInfo | null = null;
let trackAssets: TrackAssets | null = null;
let latestFrame: TelemetryFrame | null = null;
let frameDirty = false;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // req.url includes the query string; the image request carries a
  // cache-busting ?v=<track> param, so routes match on the pathname only.
  const pathname = (req.url ?? '').split('?')[0];

  if (pathname === '/api/track-map/meta') {
    if (!trackAssets?.meta) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no map for current track' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(trackAssets.meta));
    return;
  }

  if (pathname === '/api/track-map/edges') {
    if (!trackAssets?.edges) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no track edges for current track' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(trackAssets.edges));
    return;
  }

  if (pathname === '/api/track-map/image') {
    if (!trackAssets?.mapImagePath) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/png' });
    fs.createReadStream(trackAssets.mapImagePath).pipe(res);
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/ws' });

const broadcast = (message: BridgeMessage): void => {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
};

wss.on('connection', (socket) => {
  const hello: BridgeMessage[] = session
    ? [{ type: 'status', state: 'connected' }, { type: 'session', ...session }]
    : [{ type: 'status', state: 'waiting' }];
  for (const message of hello) socket.send(JSON.stringify(message));
});

const ac = new ACClient();

ac.on('session', (handshake) => {
  trackAssets = resolveTrackAssets(handshake.trackName, handshake.trackConfig);
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
  broadcast({ type: 'status', state: 'connected' });
  broadcast({ type: 'session', ...session });
});

ac.on('waiting', () => {
  session = null;
  trackAssets = null;
  latestFrame = null;
  broadcast({ type: 'status', state: 'waiting' });
});

// AC floods RTCarInfo packets; keep only the newest and flush at BROADCAST_HZ.
let nextDueAt = 0;

const flushIfDue = (): void => {
  if (!frameDirty || !latestFrame) return;
  const now = performance.now();
  if (now < nextDueAt) return;
  // Catch up in interval steps while roughly on schedule; re-anchor after a
  // long gap so a pause doesn't buy a burst of back-to-back sends.
  nextDueAt = now - nextDueAt > BROADCAST_INTERVAL_MS ? now + BROADCAST_INTERVAL_MS : nextDueAt + BROADCAST_INTERVAL_MS;
  frameDirty = false;
  broadcast({ type: 'telemetry', ...latestFrame });
};

ac.on('telemetry', (frame) => {
  latestFrame = frame;
  frameDirty = true;
  flushIfDue();
});

setInterval(flushIfDue, BROADCAST_INTERVAL_MS);

// Cut detection reads AC's shared-memory tyres-out counter (Windows, same-PC
// only) and pins each 4-tyres-out onset to the newest UDP frame's position.
const stopCutDetection = startCutDetection({
  getFrame: () => latestFrame,
  isLive: () => session !== null,
  onCut: (cut) => {
    console.log(
      `[shm] cut: ${cut.tyresOut} tyres out on lap ${cut.lapCount + 1} at (${cut.x.toFixed(1)}, ${cut.z.toFixed(1)})`,
    );
    broadcast({ type: 'cut', ...cut });
  },
});

server.listen(PORT, () => {
  console.log(`[bridge] http + ws listening on http://localhost:${PORT}`);
  ac.start();
});

const shutdown = (): void => {
  stopCutDetection();
  ac.stop();
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
