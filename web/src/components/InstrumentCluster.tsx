import { useRef } from 'react';
import type { TelemetryFrame } from '../types';
import { formatGear } from '../lib/format';

const RPM_FLOOR = 8000; // bar scale never drops below this
const REDLINE_FRACTION = 0.85; // top 15% of the scale renders as redline

const StatusLight = ({
  label,
  enabled,
  active,
  activeClass,
}: {
  label: string;
  enabled: boolean;
  active: boolean;
  activeClass: string;
}) => (
  <span
    className={`rounded px-2 py-1 text-xs font-semibold tracking-wider transition-colors ${
      active
        ? `${activeClass} text-page`
        : enabled
          ? 'bg-hairline text-ink-secondary'
          : 'bg-hairline text-ink-muted opacity-40'
    }`}
  >
    {label}
  </span>
);

export const InstrumentCluster = ({ telemetry }: { telemetry: TelemetryFrame | null }) => {
  // Rolling session max so the bar is meaningful without per-car redline data.
  const maxRpmRef = useRef(RPM_FLOOR);
  const rpm = telemetry?.rpm ?? 0;
  maxRpmRef.current = Math.max(maxRpmRef.current, rpm);
  const rpmFraction = Math.min(1, rpm / maxRpmRef.current);
  const inRedline = rpmFraction >= REDLINE_FRACTION;
  const limiter = telemetry?.engineLimiterOn ?? false;

  return (
    <section className="rounded-lg border border-edge bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-wide text-ink-muted uppercase">Speed</p>
          <p className="text-4xl font-semibold tabular-nums">
            {telemetry ? Math.round(telemetry.speedKmh) : '–'}
            <span className="ml-1 text-sm font-normal text-ink-muted">km/h</span>
          </p>
        </div>
        <p
          className={`text-7xl font-bold tabular-nums ${
            limiter ? 'animate-pulse text-redline' : inRedline ? 'text-redline' : 'text-accent'
          }`}
        >
          {telemetry ? formatGear(telemetry.gear) : '–'}
        </p>
        <div className="text-right">
          <p className="text-xs tracking-wide text-ink-muted uppercase">RPM</p>
          <p className="text-4xl font-semibold tabular-nums">
            {telemetry ? Math.round(telemetry.rpm).toLocaleString() : '–'}
          </p>
        </div>
      </div>

      <div className={`relative mt-3 h-3 overflow-hidden rounded-full bg-hairline ${limiter ? 'animate-pulse' : ''}`}>
        {/* Redline zone marker */}
        <div
          className="absolute inset-y-0 right-0 bg-redline/25"
          style={{ width: `${Math.round((1 - REDLINE_FRACTION) * 100)}%` }}
        />
        <div
          className={`h-full rounded-full ${inRedline ? 'bg-redline' : 'bg-accent'}`}
          style={{ width: `${Math.round(rpmFraction * 100)}%` }}
        />
      </div>

      <div className="mt-3 flex gap-2">
        <StatusLight
          label="ABS"
          enabled={telemetry?.absEnabled ?? false}
          active={telemetry?.absInAction ?? false}
          activeClass="bg-warning"
        />
        <StatusLight
          label="TC"
          enabled={telemetry?.tcEnabled ?? false}
          active={telemetry?.tcInAction ?? false}
          activeClass="bg-warning"
        />
        <StatusLight
          label="PIT"
          enabled={true}
          active={telemetry?.inPit ?? false}
          activeClass="bg-accent"
        />
      </div>
    </section>
  );
};
