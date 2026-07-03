import type { HandshakerResponse, TelemetryFrame } from './types.js';

export const HANDSHAKE_RESPONSE_SIZE = 408;
export const RT_CAR_INFO_SIZE = 328;

export const OperationId = {
  HANDSHAKE: 0,
  SUBSCRIBE_UPDATE: 1,
  SUBSCRIBE_SPOT: 2,
  DISMISS: 3,
} as const;

// AC's UTF-16LE strings are fixed 50-wchar buffers that keep garbage after the
// terminator (often a stray '%' or control bytes), so cut at the first control
// character or '%'. Invisible garbage here silently breaks track-folder lookups.
const readWideString = (buf: Buffer, offset: number, wchars = 50): string => {
  const raw = buf.toString('utf16le', offset, offset + wchars * 2);
  let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 32 || raw[i] === '%') {
      end = i;
      break;
    }
  }
  return raw.slice(0, end).trim();
};

export const buildHandshakePacket = (operationId: number): Buffer => {
  const buf = Buffer.alloc(12);
  buf.writeInt32LE(1, 0); // identifier (platform)
  buf.writeInt32LE(1, 4); // version
  buf.writeInt32LE(operationId, 8);
  return buf;
};

export const parseHandshakerResponse = (buf: Buffer): HandshakerResponse => ({
  carName: readWideString(buf, 0),
  driverName: readWideString(buf, 100),
  identifier: buf.readInt32LE(200),
  version: buf.readInt32LE(204),
  trackName: readWideString(buf, 208),
  trackConfig: readWideString(buf, 308),
});

const readBool = (buf: Buffer, offset: number): boolean => buf.readUInt8(offset) !== 0;

// float[4] wheel block, ordered FL, FR, RL, RR.
const readWheels = (buf: Buffer, offset: number): number[] => [
  buf.readFloatLE(offset),
  buf.readFloatLE(offset + 4),
  buf.readFloatLE(offset + 8),
  buf.readFloatLE(offset + 12),
];

// RTCarInfo struct with MSVC default alignment: char identifier + 3 pad,
// 6 bools at 20..25 + 2 pad, 15 float[4] blocks from offset 84. Total 328.
export const parseRTCarInfo = (buf: Buffer): TelemetryFrame => ({
  speedKmh: buf.readFloatLE(8),
  absEnabled: readBool(buf, 20),
  absInAction: readBool(buf, 21),
  tcInAction: readBool(buf, 22),
  tcEnabled: readBool(buf, 23),
  inPit: readBool(buf, 24),
  engineLimiterOn: readBool(buf, 25),
  accGVertical: buf.readFloatLE(28),
  accGHorizontal: buf.readFloatLE(32),
  accGFrontal: buf.readFloatLE(36),
  lapTimeMs: buf.readInt32LE(40),
  lastLapMs: buf.readInt32LE(44),
  bestLapMs: buf.readInt32LE(48),
  lapCount: buf.readInt32LE(52),
  gas: buf.readFloatLE(56),
  brake: buf.readFloatLE(60),
  clutch: buf.readFloatLE(64),
  rpm: buf.readFloatLE(68),
  steerAngle: buf.readFloatLE(72),
  gear: buf.readInt32LE(76),
  tyreSlip: readWheels(buf, 148),
  wheelLoad: readWheels(buf, 180),
  normalizedPos: buf.readFloatLE(308),
  carSlope: buf.readFloatLE(312),
  x: buf.readFloatLE(316),
  y: buf.readFloatLE(320),
  z: buf.readFloatLE(324),
});
