import type { SessionInfo, TelemetryFrame } from "@rivazza/protocol";
import { useState } from "react";

import { formatGear } from "../../lib/format";
import {
  HOVER_GROUP_CLASS,
  isImmediateActivation,
} from "../../lib/interaction";
import { speedScale } from "../../lib/speedScale";

import { AnalogGauge } from "./AnalogGauge";
import { CarSlipGlyph } from "./CarSlipGlyph";
import { PedalLamp } from "./PedalLamp";
import { TyreOverlay } from "./TyreOverlay";
import { useWheelSlipLamps } from "./useWheelSlipLamps";

const RPM_MAX = 10000;
const REDLINE_FROM_RPM = 8500;
const PEDAL_ON_THRESHOLD = 0.05;

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
    className={`rounded px-1.5 py-0.5 text-center text-xs font-semibold tracking-wider transition-colors ${
      active
        ? `${activeClass} text-page`
        : enabled
          ? "text-ink-secondary"
          : "text-ink-muted opacity-40"
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

  const [tyresOpen, setTyresOpen] = useState(false);
  const slipLamps = useWheelSlipLamps(telemetry);

  return (
    <section
      className={`${HOVER_GROUP_CLASS} relative rounded-lg border border-edge bg-surface p-4`}
      onPointerUp={(e) => {
        if (isImmediateActivation(e)) setTyresOpen((o) => !o);
      }}
    >
      <TyreOverlay telemetry={telemetry} open={tyresOpen} />

      <div className="mx-auto grid max-w-md grid-cols-[2fr_1fr] items-center gap-3">
        <AnalogGauge
          min={0}
          max={speed.max}
          value={telemetry?.speedKmh ?? 0}
          majorTickStep={speed.majorTickStep}
          label="km/h"
        >
          <p className="rounded border border-hairline bg-page px-1.5 text-2xl font-bold tabular-nums whitespace-nowrap">
            {telemetry ? Math.round(telemetry.speedKmh) : "–"}
            <span className="ml-1 text-[0.65rem] font-normal text-ink-muted">
              km/h
            </span>
          </p>
        </AnalogGauge>

        <div className="flex flex-col gap-2">
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
              className={`text-xl font-bold tabular-nums ${
                limiter ? "animate-pulse text-redline" : "text-accent"
              }`}
            >
              {telemetry ? formatGear(telemetry.gear) : "–"}
            </p>
          </AnalogGauge>

          <div className="grid grid-cols-3 gap-1">
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

          <div className="flex items-start justify-center gap-3">
            <PedalLamp
              label="THR"
              active={(telemetry?.gas ?? 0) > PEDAL_ON_THRESHOLD}
              activeClass="bg-good"
            />
            <CarSlipGlyph lamps={slipLamps} slip={telemetry?.tyreSlip} />
            <PedalLamp
              label="BRK"
              active={(telemetry?.brake ?? 0) > PEDAL_ON_THRESHOLD}
              activeClass="bg-critical"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
