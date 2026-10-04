import type { TelemetryFrame } from "@rivazza/protocol";
import { useState } from "react";

import type { LapRecord, SettledLapLog } from "../hooks/useLapHistory";
import type { LapRecording } from "../hooks/useLapRecordings";
import { formatLapTime } from "../lib/format";
import { HOVER_GROUP_CLASS, isImmediateActivation } from "../lib/interaction";
import { interpolateTimeAt, resolveReference } from "../lib/lapAnalysis";

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
      {invalid && (
        <span className="ml-2 text-[0.65rem] uppercase text-critical">inv</span>
      )}
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

const formatDelta = (deltaMs: number): string => {
  const seconds = Math.abs(deltaMs) / 1000;
  return `${deltaMs <= 0 ? "-" : "+"}${seconds.toFixed(2)}`;
};

const LapListPanel = ({
  laps,
  hoveredLapRef,
  open,
}: {
  laps: LapRecord[];
  hoveredLapRef: React.RefObject<number | null>;
  open: boolean;
}) => {
  const validTimes = laps.filter((l) => !l.invalid).map((l) => l.timeMs);
  const bestValid = validTimes.length > 0 ? Math.min(...validTimes) : null;

  return (
    <div
      className={`absolute bottom-full left-0 z-10 w-full pb-2 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 ${
        open
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
    >
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
                  {l.invalid && (
                    <span className="ml-2 text-[0.65rem] uppercase text-critical">
                      inv
                    </span>
                  )}
                </span>

                <span
                  className={`font-semibold tabular-nums ${
                    l.invalid
                      ? "text-critical"
                      : l.timeMs === bestValid
                        ? "text-best"
                        : "text-ink"
                  }`}
                >
                  {formatLapTime(l.timeMs)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

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
  const validTimes = laps.filter((l) => !l.invalid).map((l) => l.timeMs);
  const validBest = validTimes.length > 0 ? Math.min(...validTimes) : null;
  const lapAwaitingVerdict =
    telemetry !== null && telemetry.lapCount > settledRef.current.lapCount;
  const gameBest = lapAwaitingVerdict
    ? settledRef.current.bestLapMs
    : (telemetry?.bestLapMs ?? 0);

  const gameBestInvalid =
    gameBest > 0 && laps.some((l) => l.invalid && l.timeMs === gameBest);

  const bestLapMs = gameBestInvalid
    ? validBest
    : gameBest > 0
      ? gameBest
      : validBest;

  const judgedLaps = new Set(laps.map((l) => l.lap));
  const deltaMs = liveDeltaMs(
    telemetry,
    resolveReference(
      recordingsRef.current.filter((r) => judgedLaps.has(r.lap)),
      laps,
    ),
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
          laps={lapsRef.current}
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
