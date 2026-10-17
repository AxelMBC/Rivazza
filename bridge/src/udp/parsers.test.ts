import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildHandshakePacket,
  HANDSHAKE_RESPONSE_SIZE,
  OperationId,
  parseHandshakerResponse,
  parseRTCarInfo,
  RT_CAR_INFO_SIZE,
} from "./parsers";

const writeWide = (buf: Buffer, offset: number, text: string): void => {
  buf.write(text, offset, "utf16le");
};

describe("handshake packet", () => {
  test("is three little-endian int32s: device id, protocol version, operation", () => {
    const buf = buildHandshakePacket(OperationId.SUBSCRIBE_UPDATE);
    assert.equal(buf.length, 12);
    assert.equal(buf.readInt32LE(0), 1);
    assert.equal(buf.readInt32LE(4), 1);
    assert.equal(buf.readInt32LE(8), 1);
  });
});

describe("handshake response", () => {
  const response = (): Buffer => {
    const buf = Buffer.alloc(HANDSHAKE_RESPONSE_SIZE);
    writeWide(buf, 0, "ferrari_sf25");
    writeWide(buf, 100, "B4RR4Z4");
    buf.writeInt32LE(7, 200);
    buf.writeInt32LE(4, 204);
    writeWide(buf, 208, "imola");
    writeWide(buf, 308, "imola");
    return buf;
  };

  test("reads car, driver, track and config strings and the two ints", () => {
    assert.deepEqual(parseHandshakerResponse(response()), {
      carName: "ferrari_sf25",
      driverName: "B4RR4Z4",
      identifier: 7,
      version: 4,
      trackName: "imola",
      trackConfig: "imola",
    });
  });

  test("a string is cut at the first '%' AC leaves after the terminator", () => {
    const buf = response();
    writeWide(buf, 208, "magione%garbage");
    assert.equal(parseHandshakerResponse(buf).trackName, "magione");
  });

  test("a string is cut at the first control character", () => {
    const buf = response();
    writeWide(buf, 308, "gp\u0001junk");
    assert.equal(parseHandshakerResponse(buf).trackConfig, "gp");
  });

  test("a string that fills all 50 wchars is read whole", () => {
    const buf = response();
    const full = "x".repeat(50);
    writeWide(buf, 0, full);
    assert.equal(parseHandshakerResponse(buf).carName, full);
  });
});

describe("RTCarInfo", () => {
  const carInfo = (): Buffer => {
    const buf = Buffer.alloc(RT_CAR_INFO_SIZE);
    buf.writeFloatLE(212.5, 8);
    buf.writeUInt8(1, 20);
    buf.writeUInt8(0, 21);
    buf.writeUInt8(1, 22);
    buf.writeUInt8(0, 23);
    buf.writeUInt8(1, 24);
    buf.writeUInt8(0, 25);
    buf.writeFloatLE(1.5, 28);
    buf.writeFloatLE(-0.25, 32);
    buf.writeFloatLE(-3, 36);
    buf.writeInt32LE(61234, 40);
    buf.writeInt32LE(90526, 44);
    buf.writeInt32LE(86473, 48);
    buf.writeInt32LE(3, 52);
    buf.writeFloatLE(0.75, 56);
    buf.writeFloatLE(0.5, 60);
    buf.writeFloatLE(0.25, 64);
    buf.writeFloatLE(11500, 68);
    buf.writeFloatLE(-0.5, 72);
    buf.writeInt32LE(4, 76);
    [0.5, -1.5, 2, 0].forEach((v, i) => buf.writeFloatLE(v, 164 + i * 4));
    [3000, 3100, 3200, 3300].forEach((v, i) =>
      buf.writeFloatLE(v, 180 + i * 4),
    );
    buf.writeFloatLE(0.625, 308);
    buf.writeFloatLE(0.125, 312);
    buf.writeFloatLE(263.5, 316);
    buf.writeFloatLE(12.25, 320);
    buf.writeFloatLE(-9.75, 324);
    return buf;
  };

  test("reads every field at its MSVC-aligned offset", () => {
    assert.deepEqual(parseRTCarInfo(carInfo()), {
      speedKmh: 212.5,
      absEnabled: true,
      absInAction: false,
      tcInAction: true,
      tcEnabled: false,
      inPit: true,
      engineLimiterOn: false,
      accGHorizontal: 1.5,
      accGVertical: -0.25,
      accGFrontal: -3,
      lapTimeMs: 61234,
      lastLapMs: 90526,
      bestLapMs: 86473,
      lapCount: 3,
      gas: 0.75,
      brake: 0.5,
      clutch: 0.25,
      rpm: 11500,
      steerAngle: -0.5,
      gear: 4,
      tyreSlip: [0.5, 1.5, 2, 0],
      wheelLoad: [3000, 3100, 3200, 3300],
      normalizedPos: 0.625,
      carSlope: 0.125,
      x: 263.5,
      y: 12.25,
      z: -9.75,
    });
  });

  test("tyre slip comes from ndSlip at 164, not AC's zeroed tyreSlip at 148", () => {
    const buf = carInfo();
    [9, 9, 9, 9].forEach((v, i) => buf.writeFloatLE(v, 148 + i * 4));
    assert.deepEqual(parseRTCarInfo(buf).tyreSlip, [0.5, 1.5, 2, 0]);
  });

  test("a locked wheel's slip is capped at 50, and a non-finite one becomes 50", () => {
    const buf = carInfo();
    [1e7, Infinity, -Infinity, NaN].forEach((v, i) =>
      buf.writeFloatLE(v, 164 + i * 4),
    );
    assert.deepEqual(parseRTCarInfo(buf).tyreSlip, [50, 50, 50, 50]);
  });
});
