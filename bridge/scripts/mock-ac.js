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

const PHYSICS = { packetId: 0, speedKmh: 28, heading: 208, tyresOut: 244 };
const GRAPHICS = { packetId: 0, status: 4 };
const AC_STATUS = { replay: 1, live: 2, paused: 3 };

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
  ndSlip: 164,
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
const SLIP_EVERY_S = 12;
const SLIP_WINDOW_S = 1.5;
const SLIP_PEAK = 4;
const SLIP_BASELINE = 0.2;
const REAR_WHEELS = [2, 3];
const FRONT_WHEELS = [0, 1];
const GAME_EVENT_EVERY_S = 60;
const GAME_EVENT_S = 6;
const REPLAY_REWIND_S = 20;

const startSharedPages = async () => {
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
    const createPage = (name) => {
      const handle = createFileMapping(PAGE_FILE_BACKED, null, PAGE_READWRITE, 0, PAGE_SIZE, name);
      if (handle == null) return null;
      const view = mapViewOfFile(handle, FILE_MAP_WRITE, 0, 0, 0);
      if (view == null) return null;
      const staging = Buffer.alloc(PAGE_SIZE);
      return { staging, flush: () => rtlMoveMemory(view, staging, PAGE_SIZE) };
    };
    const physics = createPage('Local\\acpmf_physics');
    const graphics = createPage('Local\\acpmf_graphics');
    if (!physics || !graphics) return null;
    let physicsPacketId = 0;
    let graphicsPacketId = 0;
    return (mode, { speedKmh, heading, tyresOut }) => {
      if (mode !== 'paused') physics.staging.writeInt32LE(++physicsPacketId, PHYSICS.packetId);
      physics.staging.writeFloatLE(speedKmh, PHYSICS.speedKmh);
      physics.staging.writeFloatLE(heading, PHYSICS.heading);
      physics.staging.writeInt32LE(tyresOut, PHYSICS.tyresOut);
      physics.flush();
      graphics.staging.writeInt32LE(++graphicsPacketId, GRAPHICS.packetId);
      graphics.staging.writeInt32LE(AC_STATUS[mode], GRAPHICS.status);
      graphics.flush();
    };
  } catch {
    return null;
  }
};
const writePages = await startSharedPages();
console.log(
  writePages
    ? `[mock] shared memory live — simulated cuts every ~${CUT_EVERY_S} s of driving, a pause or a replay every ${GAME_EVENT_EVERY_S} s`
    : '[mock] shared memory off (needs Windows + koffi); udp telemetry only',
);

const slipFor = (seconds) => {
  const phase = seconds % SLIP_EVERY_S;
  const slipping = phase < SLIP_WINDOW_S;
  const rise = SLIP_PEAK * Math.sin((Math.PI * phase) / SLIP_WINDOW_S);
  const wheels = Math.floor(seconds / SLIP_EVERY_S) % 2 === 0 ? REAR_WHEELS : FRONT_WHEELS;
  return [0, 1, 2, 3].map((i) => SLIP_BASELINE + (slipping && wheels.includes(i) ? rise : 0));
};

const startedAt = Date.now();
const gameModeAt = (now) => {
  const sinceStart = (now - startedAt) / 1000;
  const event = Math.floor(sinceStart / GAME_EVENT_EVERY_S);
  if (event === 0 || sinceStart % GAME_EVENT_EVERY_S >= GAME_EVENT_S) return 'live';
  return event % 2 === 1 ? 'paused' : 'replay';
};

// Inverse of yawForward in web/src/components/TrackMap/markers.ts.
const yawAlong = (dx, dz) => Math.atan2(-dx, dz);

// magione map.ini: WIDTH=342.88 HEIGHT=861.583 X_OFFSET=187.289 Z_OFFSET=444.422
// t follows wall-clock time because Windows quantizes the send timer.
let t = 0;
let replayT = 0;
let mode = 'live';
let lastTick = Date.now();
const carInfo = () => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;
  const nextMode = gameModeAt(now);
  if (nextMode !== mode) {
    if (nextMode === 'replay') replayT = Math.max(0, t - REPLAY_REWIND_S);
    console.log(
      nextMode === 'paused'
        ? '[mock] game paused'
        : nextMode === 'replay'
          ? `[mock] replay started, ${REPLAY_REWIND_S} s back`
          : `[mock] ${mode === 'paused' ? 'resumed' : 'replay ended'}, driving`,
    );
    mode = nextMode;
  }
  if (mode === 'live') t += dt;
  if (mode === 'replay') replayT += dt;
  const at = mode === 'replay' ? replayT : t;

  const lapMs = Math.round((at * 1000) % LAP_MS);
  const speedKmh = 120 + 60 * Math.sin(at * 2);
  const b = Buffer.alloc(328);
  b.write('a', 0);
  b.writeInt32LE(328, CAR_INFO.size);
  b.writeFloatLE(speedKmh, CAR_INFO.speedKmh);
  b.writeInt32LE(lapMs, CAR_INFO.lapTimeMs);
  b.writeInt32LE(83456, CAR_INFO.lastLapMs);
  b.writeInt32LE(81999, CAR_INFO.bestLapMs);
  b.writeInt32LE(Math.floor((at * 1000) / LAP_MS), CAR_INFO.lapCount);
  b.writeFloatLE(0.5 + 0.5 * Math.sin(at * 2), CAR_INFO.gas);
  b.writeFloatLE(Math.max(0, -Math.sin(at * 2)) * 0.8, CAR_INFO.brake);
  b.writeFloatLE(5000 + 2500 * Math.sin(at * 3), CAR_INFO.rpm);
  b.writeFloatLE(25 + 20 * Math.sin(at * 2), CAR_INFO.steerAngle);
  b.writeInt32LE(GEAR_THIRD, CAR_INFO.gear);
  slipFor(at).forEach((slip, i) => b.writeFloatLE(slip, CAR_INFO.ndSlip + 4 * i));
  b.writeFloatLE((at / 30) % 1, CAR_INFO.normalizedPos);
  b.writeFloatLE(-15.8 + 120 * Math.cos(at), CAR_INFO.x);
  b.writeFloatLE(5.0, CAR_INFO.y);
  b.writeFloatLE(-13.6 + 300 * Math.sin(at), CAR_INFO.z);
  const cutting = (at + FIRST_CUT_PHASE_S) % CUT_EVERY_S < CUT_WINDOW_S;
  writePages?.(mode, {
    speedKmh,
    heading: yawAlong(-120 * Math.sin(at), 300 * Math.cos(at)),
    tyresOut: cutting ? 4 : 0,
  });
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
