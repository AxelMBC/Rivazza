import type { TelemetryFrame } from "@rivazza/protocol";

import type { LapRecord, SettledLapLog } from "../../hooks/useLapHistory";
import { bestValidLapMs } from "../../lib/lapStatus";

export const displayedBestLapMs = (
  telemetry: TelemetryFrame | null,
  laps: readonly LapRecord[],
  settled: SettledLapLog,
): number | null => {
  const lapAwaitingVerdict =
    telemetry !== null && telemetry.lapCount > settled.lapCount;
  const gameBest = lapAwaitingVerdict
    ? settled.bestLapMs
    : (telemetry?.bestLapMs ?? 0);

  const gameBestNotValid =
    gameBest > 0 &&
    laps.some((l) => l.status !== "valid" && l.timeMs === gameBest);

  return gameBest > 0 && !gameBestNotValid ? gameBest : bestValidLapMs(laps);
};
