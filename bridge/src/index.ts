import fs from 'node:fs';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { ACClient } from './acClient.js';
import { resolveTrackAssets, type TrackAssets } from './trackAssets.js';
import { resolveCarTopSpeed } from './carAssets.js';
import type { BridgeMessage, SessionInfo, TelemetryFrame } from './types.js';

const PORT = Number(process.env.BRIDGE_PORT ?? 3001);
const BROADCAST_HZ = 30;

let session: SessionInfo | null = null;
let trackAssets: TrackAssets | null = null;
let latestFrame: TelemetryFrame | null = null;
let frameDirty = false;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.url ?? '';

  if (url === '/api/track-map/meta') {
    if (!trackAssets) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no map for current track' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(trackAssets.meta));
    return;
  }

  if (url === '/api/track-map/image') {
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
    boundsAvailable: trackAssets !== null,
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

// AC floods RTCarInfo packets; keep only the newest and flush at a fixed rate.
ac.on('telemetry', (frame) => {
  latestFrame = frame;
  frameDirty = true;
});

setInterval(() => {
  if (!frameDirty || !latestFrame) return;
  frameDirty = false;
  broadcast({ type: 'telemetry', ...latestFrame });
}, 1000 / BROADCAST_HZ);

server.listen(PORT, () => {
  console.log(`[bridge] http + ws listening on http://localhost:${PORT}`);
  ac.start();
});

const shutdown = (): void => {
  ac.stop();
  server.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
