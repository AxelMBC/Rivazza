import dgram from 'node:dgram';

const NUL = String.fromCharCode(0);
const sock = dgram.createSocket('udp4');

// AC strings carry garbage after the terminator, often a '%'.
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

const PHYSICS = { packetId: 0, speedKmh: 28, tyresOut: 244 };

const CAR_INFO = {
  size: 4,
  speedKmh: 8,
  lapTimeMs: 40,
  lastLapMs: 44,
  bestLapMs: 48,
  lapCount: 52,
  gas: 56,
  brake: 60,
  rpm: 68,
  steerAngle: 72,
  gear: 76,
  normalizedPos: 308,
  x: 316,
  y: 320,
  z: 324,
};
const GEAR_THIRD = 4;
const LAP_MS = 90000;
const CUT_EVERY_S = 40;
const CUT_WINDOW_S = 0.6;
const FIRST_CUT_PHASE_S = 20;

const startPhysicsPage = async () => {
  if (process.platform !== 'win32') return null;
  try {
    const koffi = (await import('koffi')).default;
    const lib = koffi.load('kernel32.dll');
    const createFileMapping = lib.func('CreateFileMappingW', 'void *', [
      'intptr_t', 'void *', 'uint32', 'uint32', 'uint32', 'str16',
    ]);
    const mapViewOfFile = lib.func('MapViewOfFile', 'void *', [
      'void *', 'uint32', 'uint32', 'uint32', 'size_t',
    ]);
    const rtlMoveMemory = lib.func('RtlMoveMemory', 'void', ['void *', 'uint8 *', 'size_t']);
    const PAGE_FILE_BACKED = -1;
    const PAGE_READWRITE = 0x04;
    const FILE_MAP_WRITE = 0x0002;
    const PAGE_SIZE = 800;
    const handle = createFileMapping(PAGE_FILE_BACKED, null, PAGE_READWRITE, 0, PAGE_SIZE, 'Local\\acpmf_physics');
    if (handle == null) return null;
    const view = mapViewOfFile(handle, FILE_MAP_WRITE, 0, 0, 0);
    if (view == null) return null;
    const staging = Buffer.alloc(PAGE_SIZE);
    let packetId = 0;
    return (speedKmh, tyresOut) => {
      staging.writeInt32LE(++packetId, PHYSICS.packetId);
      staging.writeFloatLE(speedKmh, PHYSICS.speedKmh);
      staging.writeInt32LE(tyresOut, PHYSICS.tyresOut);
      rtlMoveMemory(view, staging, PAGE_SIZE);
    };
  } catch {
    return null;
  }
};
const writePhysics = await startPhysicsPage();
console.log(
  writePhysics
    ? '[mock] physics page live — simulated cuts every ~40 s of driving'
    : '[mock] physics page off (needs Windows + koffi); udp telemetry only',
);

// magione map.ini: WIDTH=342.88 HEIGHT=861.583 X_OFFSET=187.289 Z_OFFSET=444.422
// t follows wall-clock time because Windows quantizes the send timer.
let t = 0;
let lastTick = Date.now();
const carInfo = () => {
  const now = Date.now();
  t += (now - lastTick) / 1000;
  lastTick = now;
  const lapMs = Math.round((t * 1000) % LAP_MS);
  const speedKmh = 120 + 60 * Math.sin(t * 2);
  const b = Buffer.alloc(328);
  b.write('a', 0);
  b.writeInt32LE(328, CAR_INFO.size);
  b.writeFloatLE(speedKmh, CAR_INFO.speedKmh);
  b.writeInt32LE(lapMs, CAR_INFO.lapTimeMs);
  b.writeInt32LE(83456, CAR_INFO.lastLapMs);
  b.writeInt32LE(81999, CAR_INFO.bestLapMs);
  b.writeInt32LE(Math.floor((t * 1000) / LAP_MS), CAR_INFO.lapCount);
  b.writeFloatLE(0.5 + 0.5 * Math.sin(t * 2), CAR_INFO.gas);
  b.writeFloatLE(Math.max(0, -Math.sin(t * 2)) * 0.8, CAR_INFO.brake);
  b.writeFloatLE(5000 + 2500 * Math.sin(t * 3), CAR_INFO.rpm);
  b.writeFloatLE(25 + 20 * Math.sin(t * 2), CAR_INFO.steerAngle);
  b.writeInt32LE(GEAR_THIRD, CAR_INFO.gear);
  b.writeFloatLE((t / 30) % 1, CAR_INFO.normalizedPos);
  b.writeFloatLE(-15.8 + 120 * Math.cos(t), CAR_INFO.x);
  b.writeFloatLE(5.0, CAR_INFO.y);
  b.writeFloatLE(-13.6 + 300 * Math.sin(t), CAR_INFO.z);
  const cutting = (t + FIRST_CUT_PHASE_S) % CUT_EVERY_S < CUT_WINDOW_S;
  writePhysics?.(speedKmh, cutting ? 4 : 0);
  return b;
};

// Windows floors a 5 ms timer near 15 ms, ~65 Hz: just above the bridge's 60 Hz gate.
const SEND_INTERVAL_MS = 5;
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
      streams.set(key, setInterval(() => sock.send(carInfo(), rinfo.port, rinfo.address), SEND_INTERVAL_MS));
    }
  } else if (op === 3) {
    console.log('[mock] dismiss from', key);
    clearInterval(streams.get(key));
    streams.delete(key);
  }
});

sock.bind(9996, () => console.log('[mock] fake Assetto Corsa listening on udp 9996'));
