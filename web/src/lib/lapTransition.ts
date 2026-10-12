import type { TelemetryFrame } from "@rivazza/protocol";

const RESTART_CLOCK_SLACK_MS = 1000;

type LapTransition =
  | { kind: "first" }
  | { kind: "restart" }
  | { kind: "tick"; completedLap: number }
  | { kind: "same" };

export const classifyLapTransition = (
  prevLapCount: number | null,
  prevLapTimeMs: number,
  frame: Pick<TelemetryFrame, "lapCount" | "lapTimeMs">,
): LapTransition => {
  if (prevLapCount === null) return { kind: "first" };
  const restarted =
    frame.lapCount < prevLapCount ||
    (frame.lapCount === prevLapCount &&
      frame.lapTimeMs + RESTART_CLOCK_SLACK_MS < prevLapTimeMs);
  if (restarted) return { kind: "restart" };
  if (frame.lapCount > prevLapCount)
    return { kind: "tick", completedLap: prevLapCount + 1 };
  return { kind: "same" };
};
