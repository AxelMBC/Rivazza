import type { TelemetryFrame } from '../types';
import { formatLapTime } from '../lib/format';

const TimeTile = ({
  label,
  value,
  accentClass = 'text-ink',
}: {
  label: string;
  value: string;
  accentClass?: string;
}) => (
  <div className="rounded-lg border border-edge bg-surface px-4 py-3">
    <p className="text-xs tracking-wide text-ink-muted uppercase">{label}</p>
    <p className={`mt-1 text-2xl font-semibold tabular-nums ${accentClass}`}>{value}</p>
  </div>
);

const formatDelta = (deltaMs: number): string => {
  const seconds = Math.abs(deltaMs) / 1000;
  return `${deltaMs <= 0 ? '−' : '+'}${seconds.toFixed(2)}`;
};

export const LapTimes = ({
  telemetry,
  deltaMs,
}: {
  telemetry: TelemetryFrame | null;
  deltaMs: number | null;
}) => (
  <section className="grid grid-cols-2 gap-2">
    <TimeTile label="Current lap" value={formatLapTime(telemetry?.lapTimeMs)} />
    <TimeTile
      label="Delta"
      value={deltaMs === null ? '––.––' : formatDelta(deltaMs)}
      accentClass={deltaMs === null ? 'text-ink-muted' : deltaMs <= 0 ? 'text-good' : 'text-warning'}
    />
    <TimeTile label="Last lap" value={formatLapTime(telemetry?.lastLapMs)} />
    <TimeTile
      label="Best lap"
      value={formatLapTime(telemetry?.bestLapMs)}
      accentClass="text-best"
    />
    <div className="col-span-2 flex items-center justify-between rounded-lg border border-edge bg-surface px-4 py-2">
      <span className="text-xs tracking-wide text-ink-muted uppercase">Lap</span>
      <span className="text-lg font-semibold tabular-nums">
        {telemetry ? telemetry.lapCount + 1 : '–'}
      </span>
    </div>
  </section>
);
