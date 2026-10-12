import type { LapRecord, LapStatus } from "../../hooks/useLapHistory";
import { COLORED_LAPS, lapColor } from "../../lib/lapColors";

import type { StoredLap } from "./lineRecorder";

export type LegendEntry = {
  lap: number;
  color: string;
  timeMs: number | null;
  status: LapStatus | undefined;
};

export const legendEntries = (
  previousLaps: StoredLap[],
  laps: LapRecord[],
): LegendEntry[] =>
  previousLaps
    .slice(Math.max(0, previousLaps.length - COLORED_LAPS))
    .map(({ lap }) => {
      const record = laps.find((l) => l.lap === lap);
      return {
        lap,
        color: lapColor(lap),
        timeMs: record?.timeMs ?? null,
        status: record?.status,
      };
    })
    .reverse();

export const legendKey = (entries: LegendEntry[]) =>
  entries.map((e) => `${e.lap}:${e.timeMs}:${e.status}`).join("|");
