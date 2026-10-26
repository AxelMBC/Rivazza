import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";

import { SHM_STATE } from "./kernel32.js";
import type { LazyPage } from "./lazyPage.js";

// SPageFilePhysics is #pragma pack(4) and every member before these is a
// 4-byte scalar or float array, so the offsets are stable.
const OFF_PACKET_ID = 0; // frozen while paused, in menus, or closed
const OFF_SPEED_KMH = 28;
const OFF_TYRES_OUT = 244;
const READ_SIZE = 256;

// Windows ticks timers every ~15.6 ms: under one tick polls at ~64 Hz, while
// 16 ms rounds up to two ticks and polls at ~32 Hz.
const POLL_MS = 10;
const CUT_TYRES = 4; // AC invalidates a lap at four wheels beyond the limits
const MIN_SPEED_KMH = 10;

type CutDetector = {
  physics: LazyPage;
  isHeld: () => boolean;
  getFrame: () => TelemetryFrame | null;
  isLive: () => boolean;
  onCut: (cut: CutEvent) => void;
};

export const startCutDetection = (detector: CutDetector): (() => void) => {
  if (SHM_STATE !== "enabled") return () => {};

  const page = Buffer.alloc(READ_SIZE);
  let lastPacketId: number | null = null;
  let wasOut = false;

  const poll = (): void => {
    if (detector.isHeld() || !detector.physics.read(page)) return;
    const packetId = page.readInt32LE(OFF_PACKET_ID);
    if (packetId === lastPacketId) return;
    lastPacketId = packetId;

    const tyresOut = page.readInt32LE(OFF_TYRES_OUT);
    const isOut = tyresOut >= CUT_TYRES;
    const onset = isOut && !wasOut;
    wasOut = isOut;
    if (!onset) return;

    const frame = detector.getFrame();
    const speedKmh = page.readFloatLE(OFF_SPEED_KMH);
    if (!detector.isLive() || !frame || frame.inPit || speedKmh < MIN_SPEED_KMH)
      return;
    detector.onCut({
      lapCount: frame.lapCount,
      lapTimeMs: frame.lapTimeMs,
      x: frame.x,
      z: frame.z,
      speedKmh: frame.speedKmh,
      tyresOut,
    });
  };

  const pollTimer = setInterval(poll, POLL_MS);
  return () => clearInterval(pollTimer);
};
