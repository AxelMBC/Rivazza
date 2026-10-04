import type { LapStatus } from "../hooks/useLapHistory";

export type LapStatusTag = { text: string; toneClass: string };

export const isPitLap = (status: LapStatus | undefined): boolean =>
  status === "out" || status === "in";

export const lapStatusTag = (
  status: LapStatus | undefined,
): LapStatusTag | null => {
  switch (status) {
    case undefined:
    case "valid":
      return null;
    case "invalid":
      return { text: "inv", toneClass: "text-critical" };
    case "out":
    case "in":
      return { text: status, toneClass: "text-ink-secondary" };
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
};
