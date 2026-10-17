import type { TelemetryFrame } from "@rivazza/protocol";
import { useState } from "react";

import type { LapRecord, SettledLapLog } from "../../hooks/useLapHistory";
import type { LapRecording } from "../../hooks/useLapRecordings";
import { formatDelta, formatLapTime } from "../../lib/format";
import {
  HOVER_GROUP_CLASS,
  isImmediateActivation,
} from "../../lib/interaction";
import { interpolateTimeAt, resolveReference } from "../../lib/lapAnalysis";
import { bestValidLapMs } from "../../lib/lapStatus";
import { LapStatusChip } from "../LapStatusChip";

import { displayedBestLapMs } from "./bestLap";
import { LapListPanel } from "./LapListPanel";

const TimeTile = ({
  label,
  value,
  accentClass = "text-ink",
  invalid = false,
  className = "",
}: {
  label: string;
  value: string;
  accentClass?: string;
  invalid?: boolean;
  className?: string;
}) => (
  <div
    className={`rounded-lg border border-edge bg-surface px-4 py-2 ${className}`}
  >
    <p className="text-xs tracking-wide text-ink-muted uppercase">
      {label}
      {invalid && <LapStatusChip status="invalid" className="ml-2" />}
    </p>

    <p
      className={`mt-1 text-2xl font-semibold tabular-nums ${invalid ? "text-critical" : accentClass}`}
    >
      {value}
    </p>
  </div>
);

const COMPLETED_LAP_TILE_CLASS =
  "transition-colors hover:border-accent/60 group-hover:border-accent/60";

const liveDeltaMs = (
  telemetry: TelemetryFrame | null,
  reference: LapRecording | null,
): number | null => {
  if (!telemetry || !reference) return null;
  const refTimeMs = interpolateTimeAt(
    reference.samples,
    telemetry.normalizedPos,
  );
  return refTimeMs === null ? null : telemetry.lapTimeMs - refTimeMs;
};

export const LapTimes = ({
  telemetry,
  lapsRef,
  recordingsRef,
  currentLapInvalidRef,
  settledRef,
  hoveredLapRef,
  className = "",
}: {
  telemetry: TelemetryFrame | null;
  lapsRef: React.RefObject<LapRecord[]>;
  recordingsRef: React.RefObject<LapRecording[]>;
  currentLapInvalidRef: React.RefObject<boolean>;
  settledRef: React.RefObject<SettledLapLog>;
  hoveredLapRef: React.RefObject<number | null>;
  className?: string;
}) => {
  const laps = lapsRef.current;
  const bestLapMs = displayedBestLapMs(telemetry, laps, settledRef.current);
  const deltaMs = liveDeltaMs(
    telemetry,
    resolveReference(recordingsRef.current, laps),
  );

  const [listOpen, setListOpen] = useState(false);

  return (
    <section className={`grid grid-cols-2 gap-2 ${className}`}>
      <TimeTile
        label={`Lap ${telemetry ? telemetry.lapCount + 1 : "–"}`}
        value={formatLapTime(telemetry?.lapTimeMs)}
        invalid={currentLapInvalidRef.current}
      />
      <TimeTile
        label="Delta"
        value={deltaMs === null ? "--.--" : formatDelta(deltaMs)}
        accentClass={
          deltaMs === null
            ? "text-ink-muted"
            : deltaMs <= 0
              ? "text-good"
              : "text-warning"
        }
      />

      <div
        className={`${HOVER_GROUP_CLASS} relative col-span-2 grid grid-cols-2 gap-2`}
        onPointerUp={(e) => {
          if (!isImmediateActivation(e)) return;
          setListOpen((o) => {
            if (o) hoveredLapRef.current = null;
            return !o;
          });
        }}
      >
        <LapListPanel
          laps={laps}
          bestValidMs={bestValidLapMs(laps)}
          hoveredLapRef={hoveredLapRef}
          open={listOpen}
        />

        <TimeTile
          label="Last lap"
          value={formatLapTime(telemetry?.lastLapMs)}
          className={COMPLETED_LAP_TILE_CLASS}
        />
        <TimeTile
          label="Best lap"
          value={formatLapTime(bestLapMs)}
          accentClass="text-best"
          className={COMPLETED_LAP_TILE_CLASS}
        />
      </div>
    </section>
  );
};
