import type { SessionInfo, TelemetryFrame } from '../types';
import { formatGear } from '../lib/format';
import { speedScale } from '../lib/speedScale';
import { AnalogGauge } from './AnalogGauge';
import { TyreOverlay } from './TyreOverlay';

const RPM_MAX = 10000;
const REDLINE_FROM_RPM = 8500;

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

export const InstrumentCluster = ({
  telemetry,
  session,
}: {
  telemetry: TelemetryFrame | null;
  session: SessionInfo;
}) => {
  const limiter = telemetry?.engineLimiterOn ?? false;
  const speed = speedScale(session.topSpeedKmh);

  return (
    <section className="group relative rounded-lg border border-edge bg-surface p-4">
      <TyreOverlay telemetry={telemetry} />
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        <AnalogGauge
          min={0}
          max={speed.max}
          value={telemetry?.speedKmh ?? 0}
          majorTickStep={speed.majorTickStep}
          label="km/h"
        >
          <p className="rounded border border-hairline bg-page px-2 py-0.5 text-sm font-semibold tabular-nums whitespace-nowrap">
            {telemetry ? Math.round(telemetry.speedKmh) : '–'}
            <span className="ml-1 text-[0.65rem] font-normal text-ink-muted">km/h</span>
          </p>
        </AnalogGauge>

        <AnalogGauge
          min={0}
          max={RPM_MAX}
          value={telemetry?.rpm ?? 0}
          majorTickStep={1000}
          redlineFrom={REDLINE_FROM_RPM}
          formatTickLabel={(rpm) => String(rpm / 1000)}
          label="rpm ×1000"
          flash={limiter}
        >
          <p
            className={`text-3xl font-bold tabular-nums ${
              limiter ? 'animate-pulse text-redline' : 'text-accent'
            }`}
          >
            {telemetry ? formatGear(telemetry.gear) : '–'}
          </p>
        </AnalogGauge>
      </div>

      <div className="mt-3 flex justify-center gap-2">
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
