import type { TelemetryFrame } from "@rivazza/protocol";

const MAX_DEG = 180;

export const SteeringBar = ({
  telemetry,
}: {
  telemetry: TelemetryFrame | null;
}) => {
  const angle = telemetry?.steerAngle ?? 0;
  const fraction = Math.max(-1, Math.min(1, angle / MAX_DEG));

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs tracking-wide text-ink-muted uppercase">Steering</p>
      <div className="relative h-3 flex-1">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-hairline" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent"
          style={
            fraction < 0
              ? { right: "50%", width: `${Math.abs(fraction) * 50}%` }
              : { left: "50%", width: `${fraction * 50}%` }
          }
        />
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-ink-muted" />
      </div>
      <p className="w-10 text-right text-sm font-semibold tabular-nums text-ink-secondary">
        {telemetry ? `${Math.round(angle)}°` : "–"}
      </p>
    </div>
  );
};
