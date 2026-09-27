import type { TelemetryFrame } from "@rivazza/protocol";

export type FrameThrottle = {
  push: (frame: TelemetryFrame) => void;
  latest: () => TelemetryFrame | null;
  clear: () => void;
  stop: () => void;
};

export const createFrameThrottle = (
  intervalMs: number,
  send: (frame: TelemetryFrame) => void,
): FrameThrottle => {
  let latestFrame: TelemetryFrame | null = null;
  let frameDirty = false;
  let nextDueAt = 0;

  const flushIfDue = (): void => {
    if (!frameDirty || !latestFrame) return;
    const now = performance.now();
    if (now < nextDueAt) return;
    // Catch up in interval steps while roughly on schedule; re-anchor after a
    // long gap so a pause doesn't buy a burst of back-to-back sends.
    nextDueAt =
      now - nextDueAt > intervalMs ? now + intervalMs : nextDueAt + intervalMs;
    frameDirty = false;
    send(latestFrame);
  };

  const sweep = setInterval(flushIfDue, intervalMs);

  return {
    push: (frame) => {
      latestFrame = frame;
      frameDirty = true;
      flushIfDue();
    },
    latest: () => latestFrame,
    clear: () => {
      latestFrame = null;
    },
    stop: () => clearInterval(sweep),
  };
};
