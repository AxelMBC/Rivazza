import type { TelemetryFrame } from '../types';

const MAX_DEG = 180; // full deflection of the indicator

export const SteeringBar = ({ telemetry }: { telemetry: TelemetryFrame | null }) => {
  const angle = telemetry?.steerAngle ?? 0;
  const fraction = Math.max(-1, Math.min(1, angle / MAX_DEG));

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs tracking-wide text-ink-muted uppercase">Steering</p>
        <p className="text-xs tabular-nums text-ink-secondary">{Math.round(angle)}°</p>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-hairline">
        {/* Center mark */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-ink-muted" />
        <div
          className="absolute inset-y-0 rounded-full bg-accent"
          style={
            fraction < 0
              ? { right: '50%', width: `${Math.abs(fraction) * 50}%` }
              : { left: '50%', width: `${fraction * 50}%` }
          }
        />
      </div>
    </div>
  );
};
