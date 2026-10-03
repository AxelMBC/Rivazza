import type { TelemetryFrame } from "@rivazza/protocol";

export type HandshakerResponse = {
  carName: string;
  driverName: string;
  identifier: number;
  version: number;
  trackName: string;
  trackConfig: string;
};

export const HANDSHAKE_RESPONSE_SIZE = 408;
export const RT_CAR_INFO_SIZE = 328;

export const OperationId = {
  HANDSHAKE: 0,
  SUBSCRIBE_UPDATE: 1,
  SUBSCRIBE_SPOT: 2,
  DISMISS: 3,
} as const;

const DEVICE_IDENTIFIER = 1;
const PROTOCOL_VERSION = 1;

// AC's fixed 50-wchar UTF-16LE buffers keep garbage after the terminator,
// often a stray '%' or control bytes.
const readWideString = (buf: Buffer, offset: number, wchars = 50): string => {
  const raw = buf.toString("utf16le", offset, offset + wchars * 2);
  let end = raw.length;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 32 || raw[i] === "%") {
      end = i;
      break;
    }
  }
  return raw.slice(0, end).trim();
};

export const buildHandshakePacket = (operationId: number): Buffer => {
  const buf = Buffer.alloc(12);
  buf.writeInt32LE(DEVICE_IDENTIFIER, 0);
  buf.writeInt32LE(PROTOCOL_VERSION, 4);
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

const readBool = (buf: Buffer, offset: number): boolean =>
  buf.readUInt8(offset) !== 0;

const readWheels = (buf: Buffer, offset: number): number[] => [
  buf.readFloatLE(offset),
  buf.readFloatLE(offset + 4),
  buf.readFloatLE(offset + 8),
  buf.readFloatLE(offset + 12),
];

// A locked wheel drives ndSlip past 1e6 or to Infinity, and JSON turns a
// non-finite number into null.
const SLIP_CAP = 50;

const capSlip = (slip: number): number =>
  Number.isFinite(slip) ? Math.min(Math.abs(slip), SLIP_CAP) : SLIP_CAP;

// RTCarInfo struct with MSVC default alignment: char identifier + 3 pad,
// 6 bools at 20..25 + 2 pad, 15 float[4] blocks from offset 84. Total 328.
// tyreSlip is decoded from ndSlip @164: AC leaves its own tyreSlip @148 at zero.
export const parseRTCarInfo = (buf: Buffer): TelemetryFrame => ({
  speedKmh: buf.readFloatLE(8),
  absEnabled: readBool(buf, 20),
  absInAction: readBool(buf, 21),
  tcInAction: readBool(buf, 22),
  tcEnabled: readBool(buf, 23),
  inPit: readBool(buf, 24),
  engineLimiterOn: readBool(buf, 25),
  // AC's docs name offset 28 accG_vertical and 32 accG_horizontal, but 28
  // carries lateral G and 32 vertical (checked against position-derived motion).
  accGHorizontal: buf.readFloatLE(28),
  accGVertical: buf.readFloatLE(32),
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
  tyreSlip: readWheels(buf, 164).map(capSlip),
  wheelLoad: readWheels(buf, 180),
  normalizedPos: buf.readFloatLE(308),
  carSlope: buf.readFloatLE(312),
  x: buf.readFloatLE(316),
  y: buf.readFloatLE(320),
  z: buf.readFloatLE(324),
});
