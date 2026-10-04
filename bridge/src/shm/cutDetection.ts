import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";

import {
  kernel32,
  SHM_STATE,
  type Kernel32,
  type MappedPage,
} from "./kernel32.js";

// SPageFilePhysics is #pragma pack(4) and every member before these is a
// 4-byte scalar or float array, so the offsets are stable.
const MAPPING_NAME = "Local\\acpmf_physics";
const OFF_PACKET_ID = 0; // frozen while paused, in menus, or closed
const OFF_SPEED_KMH = 28;
const OFF_TYRES_OUT = 244;
const READ_SIZE = 256;

const POLL_MS = 16; // ~60 Hz nominal; Windows floors short timers near 15.6 ms
const OPEN_RETRY_MS = 3000;
const CUT_TYRES = 4; // AC invalidates a lap at four wheels beyond the limits
const MIN_SPEED_KMH = 10;

type CutDetector = {
  getFrame: () => TelemetryFrame | null;
  isLive: () => boolean;
  onCut: (cut: CutEvent) => void;
};

export const startCutDetection = (detector: CutDetector): (() => void) => {
  if (SHM_STATE === "unsupported") return () => {};
  if (SHM_STATE === "disabled") {
    console.log("[shm] cut detection disabled (AC_SHM=0)");
    return () => {};
  }

  let stopped = false;
  let pollTimer: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let physics: MappedPage | null = null;

  const page = Buffer.alloc(READ_SIZE);
  let lastPacketId: number | null = null;
  let wasOut = false;

  const poll = (): void => {
    if (!physics) return;
    physics.read(page);
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

  const tryOpen = (k32: Kernel32): void => {
    if (stopped) return;
    physics = k32.mapPage(MAPPING_NAME);
    if (!physics) return;
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
    console.log("[shm] physics page mapped, cut detection live");
    pollTimer = setInterval(poll, POLL_MS);
  };

  void kernel32().then((k32) => {
    if (!k32 || stopped) return;
    tryOpen(k32);
    if (!physics) {
      console.log(
        "[shm] physics page not available (is AC running on this PC?), retrying quietly",
      );
      retryTimer = setInterval(() => tryOpen(k32), OPEN_RETRY_MS);
    }
  });

  return () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (retryTimer) clearInterval(retryTimer);
    physics?.close();
  };
};
