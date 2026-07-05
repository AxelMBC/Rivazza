// Mock Assetto Corsa remote telemetry server for testing the dashboard
// without the game: binds UDP 9996, answers the handshake, and streams
// RTCarInfo packets for a car lapping an oval inside magione's map bounds.
// Run with: npm run mock -w bridge
import dgram from 'node:dgram';

const NUL = String.fromCharCode(0);
const sock = dgram.createSocket('udp4');

// Real AC strings are NUL-terminated with garbage after (often a '%').
const writeWStr = (buf, off, str) => buf.write(str + NUL + 'garbage%', off, 'utf16le');

const handshakeResponse = () => {
  const b = Buffer.alloc(408);
  writeWStr(b, 0, 'abarth500');
  writeWStr(b, 100, 'Mock Driver');
  b.writeInt32LE(4242, 200);
  b.writeInt32LE(1, 204);
  writeWStr(b, 208, 'magione');
  writeWStr(b, 308, '');
  return b;
};

// magione map.ini: WIDTH=342.88 HEIGHT=861.583 X_OFFSET=187.289 Z_OFFSET=444.422
// so the oval below stays inside the map image.
// t advances by real elapsed time so the car's pace is independent of how
// fast (and how coarsely Windows quantizes) the send timer actually fires.
let t = 0;
let lastTick = Date.now();
const carInfo = () => {
  const now = Date.now();
  t += (now - lastTick) / 1000;
  lastTick = now;
  const lapMs = Math.round((t * 1000) % 90000);
  const b = Buffer.alloc(328);
  b.write('a', 0);
  b.writeInt32LE(328, 4);
  b.writeFloatLE(120 + 60 * Math.sin(t * 2), 8); // speed kmh
  b.writeInt32LE(lapMs, 40); // lapTime
  b.writeInt32LE(83456, 44); // lastLap
  b.writeInt32LE(81999, 48); // bestLap
  b.writeInt32LE(Math.floor((t * 1000) / 90000), 52); // lapCount
  b.writeFloatLE(0.5 + 0.5 * Math.sin(t * 2), 56); // gas
  b.writeFloatLE(Math.max(0, -Math.sin(t * 2)) * 0.8, 60); // brake
  b.writeFloatLE(5000 + 2500 * Math.sin(t * 3), 68); // rpm
  b.writeInt32LE(4, 76); // gear (3rd)
  b.writeFloatLE((t / 30) % 1, 308); // normalized position
  b.writeFloatLE(-15.8 + 120 * Math.cos(t), 316); // world x
  b.writeFloatLE(5.0, 320); // world y
  b.writeFloatLE(-13.6 + 300 * Math.sin(t), 324); // world z
  return b;
};

const streams = new Map();

sock.on('message', (msg, rinfo) => {
  if (msg.length !== 12) return;
  const op = msg.readInt32LE(8);
  const key = `${rinfo.address}:${rinfo.port}`;
  if (op === 0) {
    console.log('[mock] handshake from', key);
    sock.send(handshakeResponse(), rinfo.port, rinfo.address);
  } else if (op === 1) {
    console.log('[mock] subscribe from', key);
    if (!streams.has(key)) {
      // Real AC floods packets far faster than any consumer rate; a 5 ms ask
      // lands around Windows' timer floor (~15 ms → ~65+ Hz), fast enough to
      // exercise the bridge's 60 Hz delivery gate.
      streams.set(key, setInterval(() => sock.send(carInfo(), rinfo.port, rinfo.address), 5));
    }
  } else if (op === 3) {
    console.log('[mock] dismiss from', key);
    clearInterval(streams.get(key));
    streams.delete(key);
  }
});

sock.bind(9996, () => console.log('[mock] fake Assetto Corsa listening on udp 9996'));
