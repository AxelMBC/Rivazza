import type { LapRecord } from "../../hooks/useLapHistory";
import { formatLapTime } from "../../lib/format";
import { isImmediateActivation } from "../../lib/interaction";
import { lapStatusTag } from "../../lib/lapStatus";
import { LapStatusChip } from "../LapStatusChip";
import { RevealPanel } from "../RevealPanel";

type Props = {
  laps: LapRecord[];
  bestValidMs: number | null;
  hoveredLapRef: React.RefObject<number | null>;
  open: boolean;
};

export const LapListPanel = ({
  laps,
  bestValidMs,
  hoveredLapRef,
  open,
}: Props) => (
  <RevealPanel open={open}>
    <div
      className="max-h-64 overflow-y-auto rounded-lg border border-edge bg-page/95 p-3 shadow-xl backdrop-blur"
      onMouseLeave={() => {
        hoveredLapRef.current = null;
      }}
      onPointerUp={(e) => {
        if (isImmediateActivation(e)) e.stopPropagation();
      }}
    >
      <p className="mb-2 text-xs tracking-wide text-ink-muted uppercase">
        Session laps
      </p>

      {laps.length === 0 ? (
        <p className="text-sm text-ink-muted">No laps completed yet</p>
      ) : (
        <ul className="space-y-1">
          {laps.map((l) => (
            <li
              key={l.lap}
              className="flex items-center justify-between gap-6 text-sm"
              onMouseEnter={() => {
                hoveredLapRef.current = l.lap;
              }}
              onMouseLeave={() => {
                hoveredLapRef.current = null;
              }}
              onPointerUp={(e) => {
                if (e.pointerType === "touch") hoveredLapRef.current = l.lap;
              }}
            >
              <span className="text-ink-muted">
                Lap {l.lap}
                <LapStatusChip status={l.status} className="ml-2" />
              </span>

              <span
                className={`font-semibold tabular-nums ${
                  lapStatusTag(l.status)?.toneClass ??
                  (l.timeMs === bestValidMs ? "text-best" : "text-ink")
                }`}
              >
                {formatLapTime(l.timeMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </RevealPanel>
);
