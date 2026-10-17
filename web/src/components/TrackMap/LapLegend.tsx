import { formatLapTime } from "../../lib/format";
import { isPitLap, lapStatusTag } from "../../lib/lapStatus";
import { LapStatusChip } from "../LapStatusChip";

import type { LegendEntry } from "./legend";

type Props = { entries: LegendEntry[] };

export const LapLegend = ({ entries }: Props) =>
  entries.length > 0 && (
    <div className="pointer-events-none absolute right-4 bottom-3 flex flex-col gap-1 text-xs">
      {entries.map((entry) => {
        const tag = lapStatusTag(entry.status);
        return (
          <span
            key={entry.lap}
            className="flex items-center justify-end gap-1.5"
          >
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-ink-muted">
              Lap {entry.lap}
              {isPitLap(entry.status) && (
                <LapStatusChip status={entry.status} className="ml-1.5" />
              )}
            </span>
            {entry.timeMs != null && (
              <span
                className={`tabular-nums ${tag?.toneClass ?? "text-ink-secondary"}`}
              >
                {formatLapTime(entry.timeMs)}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
