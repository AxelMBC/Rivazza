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
    const resumingAfterGap = now - nextDueAt > intervalMs;
    nextDueAt = resumingAfterGap ? now + intervalMs : nextDueAt + intervalMs;
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
