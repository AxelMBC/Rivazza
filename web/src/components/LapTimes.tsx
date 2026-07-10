import { useState } from 'react';
import type { TelemetryFrame } from '../types';
import type { LapRecord } from '../hooks/useLapHistory';
import { formatLapTime } from '../lib/format';

const TimeTile = ({
  label,
  value,
  accentClass = 'text-ink',
  invalid = false,
}: {
  label: string;
  value: string;
  accentClass?: string;
  invalid?: boolean;
}) => (
  <div className="rounded-lg border border-edge bg-surface px-4 py-3">
    <p className="text-xs tracking-wide text-ink-muted uppercase">
      {label}
      {invalid && <span className="ml-2 text-[0.65rem] uppercase text-critical">inv</span>}
    </p>
    <p className={`mt-1 text-2xl font-semibold tabular-nums ${invalid ? 'text-critical' : accentClass}`}>
      {value}
    </p>
  </div>
);

const formatDelta = (deltaMs: number): string => {
  const seconds = Math.abs(deltaMs) / 1000;
  return `${deltaMs <= 0 ? '−' : '+'}${seconds.toFixed(2)}`;
};

// Hover-revealed session lap log. The outer wrapper uses padding (not margin)
// to bridge the gap above the Lap tile, so the cursor can travel from tile to
// panel without leaving the hover group — required to wheel-scroll the list
// without ever clicking (clicks would steal focus from the game). On touch
// the tile's tap toggle drives `open` instead (Tailwind v4 scopes group-hover
// to hover-capable devices, so emulated hover never fights the state).
// Hovering a row writes its lap number into hoveredLapRef so the track map
// reveals that lap's cut markers — a ref, read by the map's rAF loop, so the
// hover costs no re-renders. Rows do the same on tap.
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
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div
        className="max-h-64 overflow-y-auto rounded-lg border border-edge bg-page/95 p-3 shadow-xl backdrop-blur"
        onMouseLeave={() => {
          hoveredLapRef.current = null;
        }}
        onPointerUp={(e) => {
          // In-panel taps (rows, list scrolling) must not bubble to the Lap
          // tile's open/close toggle.
          if (e.pointerType === 'touch') e.stopPropagation();
        }}
      >
        <p className="mb-2 text-xs tracking-wide text-ink-muted uppercase">Session laps</p>
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
                  if (e.pointerType === 'touch') hoveredLapRef.current = l.lap;
                }}
              >
                <span className="text-ink-muted">
                  Lap {l.lap}
                  {l.invalid && <span className="ml-2 text-[0.65rem] uppercase text-critical">inv</span>}
                </span>
                <span
                  className={`font-semibold tabular-nums ${
                    l.invalid
                      ? 'text-critical'
                      : l.timeMs === bestValid
                        ? 'text-best'
                        : 'text-ink'
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

export const LapTimes = ({
  telemetry,
  deltaMs,
  lapsRef,
  currentLapInvalidRef,
  hoveredLapRef,
}: {
  telemetry: TelemetryFrame | null;
  deltaMs: number | null;
  lapsRef: React.RefObject<LapRecord[]>;
  currentLapInvalidRef: React.RefObject<boolean>;
  hoveredLapRef: React.RefObject<number | null>;
}) => {
  // Best lap trusts the game's bestLapMs unless the lap log knows that time
  // belongs to an invalidated lap (AC adopts cut laps as "best" in some
  // sessions) — then the fastest valid recorded lap is the best the driver
  // actually owns, or a placeholder when no valid lap exists yet.
  const laps = lapsRef.current;
  const validTimes = laps.filter((l) => !l.invalid).map((l) => l.timeMs);
  const validBest = validTimes.length > 0 ? Math.min(...validTimes) : null;
  const gameBest = telemetry?.bestLapMs ?? 0;
  const gameBestInvalid =
    gameBest > 0 && laps.some((l) => l.invalid && l.timeMs === gameBest);
  const bestLapMs = gameBestInvalid ? validBest : gameBest > 0 ? gameBest : validBest;
  // Touch-only reveal state for the lap list; desktop stays pure group-hover.
  const [listOpen, setListOpen] = useState(false);

  return (
  <section className="grid grid-cols-2 gap-2">
    <TimeTile
      label="Current lap"
      value={formatLapTime(telemetry?.lapTimeMs)}
      invalid={currentLapInvalidRef.current}
    />
    <TimeTile
      label="Delta"
      value={deltaMs === null ? '––.––' : formatDelta(deltaMs)}
      accentClass={deltaMs === null ? 'text-ink-muted' : deltaMs <= 0 ? 'text-good' : 'text-warning'}
    />
    <TimeTile label="Last lap" value={formatLapTime(telemetry?.lastLapMs)} />
    <TimeTile
      label="Best lap"
      value={formatLapTime(bestLapMs)}
      accentClass="text-best"
    />
    <div
      className="group relative col-span-2 flex items-center justify-between rounded-lg border border-edge bg-surface px-4 py-2 transition-colors hover:border-accent/60"
      onPointerUp={(e) => {
        if (e.pointerType !== 'touch') return;
        setListOpen((o) => {
          // Closing drops any row focus so the map doesn't keep a stale lap lit.
          if (o) hoveredLapRef.current = null;
          return !o;
        });
      }}
    >
      <LapListPanel laps={lapsRef.current} hoveredLapRef={hoveredLapRef} open={listOpen} />
      <span className="text-xs tracking-wide text-ink-muted uppercase">Lap</span>
      <span className="text-lg font-semibold tabular-nums">
        {telemetry ? telemetry.lapCount + 1 : '–'}
      </span>
    </div>
  </section>
  );
};
