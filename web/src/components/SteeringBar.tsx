import type { TelemetryFrame } from "../types";

const MAX_DEG = 180;

export const SteeringBar = ({
  telemetry,
}: {
  telemetry: TelemetryFrame | null;
}) => {
  const angle = telemetry?.steerAngle ?? 0;
  const fraction = Math.max(-1, Math.min(1, angle / MAX_DEG));

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-hairline">
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink-muted" />
        <div
          className="absolute inset-y-0 rounded-full bg-accent"
          style={
            fraction < 0
              ? { right: "50%", width: `${Math.abs(fraction) * 50}%` }
              : { left: "50%", width: `${fraction * 50}%` }
          }
        />
      </div>
      <p className="w-10 text-right text-xs tabular-nums text-ink-secondary">
        {Math.round(angle)}°
      </p>
    </div>
  );
};
