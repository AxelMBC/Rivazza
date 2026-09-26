import type { TelemetryFrame } from "../types";

const PedalBar = ({
  label,
  value,
  fillClass,
}: {
  label: string;
  value: number | null;
  fillClass: string;
}) => {
  const fraction = Math.max(0, Math.min(1, value ?? 0));

  return (
    <div className="flex min-h-0 w-8 flex-col items-center gap-1">
      <p className="text-xs tabular-nums text-ink-secondary">
        {value === null ? "–" : Math.round(fraction * 100)}
      </p>
      <div className="relative min-h-0 w-2 flex-1 overflow-hidden rounded-full bg-hairline">
        <div
          className={`absolute inset-x-0 bottom-0 rounded-full ${fillClass}`}
          style={{ height: `${fraction * 100}%` }}
        />
      </div>
      <p className="text-xs tracking-wide text-ink-muted uppercase">{label}</p>
    </div>
  );
};

export const PedalBars = ({
  telemetry,
}: {
  telemetry: TelemetryFrame | null;
}) => (
  <div className="flex min-h-0 gap-1">
    <PedalBar label="Thr" value={telemetry?.gas ?? null} fillClass="bg-good" />
    <PedalBar
      label="Brk"
      value={telemetry?.brake ?? null}
      fillClass="bg-critical"
    />
  </div>
);
