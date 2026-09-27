import type { LapRecord } from "../../hooks/useLapHistory";
import type { LapRecording } from "../../hooks/useLapRecordings";
import { formatLapTime } from "../../lib/format";
import { lapColor } from "../../lib/lapColors";

type Props = {
  reviewableLaps: LapRecording[];
  laps: LapRecord[];
  selected: LapRecording | null;
  reference: LapRecording | null;
  onSelect: (lap: number) => void;
};

export const LapChips = ({
  reviewableLaps,
  laps,
  selected,
  reference,
  onSelect,
}: Props) => (
  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
    {[...reviewableLaps].reverse().map((rec) => {
      const record = laps.find((l) => l.lap === rec.lap);
      const isSelected = selected === rec;
      return (
        <span
          key={rec.lap}
          onMouseEnter={() => onSelect(rec.lap)}
          onPointerUp={(e) => {
            if (e.pointerType === "touch") onSelect(rec.lap);
          }}
          className={`flex shrink-0 cursor-default items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${
            isSelected
              ? "border-accent/70 bg-page"
              : "border-edge hover:border-accent/40"
          }`}
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: lapColor(rec.lap) }}
          />
          <span className="text-ink-muted">
            Lap {rec.lap}
            {record?.invalid && (
              <span className="ml-1.5 text-[0.65rem] uppercase text-critical">
                inv
              </span>
            )}
          </span>
          <span
            className={`font-semibold tabular-nums ${
              record?.invalid
                ? "text-critical"
                : rec === reference
                  ? "text-best"
                  : "text-ink-secondary"
            }`}
          >
            {formatLapTime(rec.timeMs)}
          </span>
        </span>
      );
    })}
  </div>
);
