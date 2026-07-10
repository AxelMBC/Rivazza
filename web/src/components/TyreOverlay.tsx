import type { TelemetryFrame } from '../types';

// Car layout: front row then rear row — matches the tyreSlip/wheelLoad
// array order (FL, FR, RL, RR).
const WHEEL_LABELS = ['FL', 'FR', 'RL', 'RR'] as const;

// tyreSlip sits near 0 while gripping and spikes during wheelspin or
// lock-up; thresholds grade the readout without needing exact units.
const SLIP_WARNING = 1;
const SLIP_CRITICAL = 3;

const slipClass = (slip: number): string => {
  const s = Math.abs(slip);
  if (s >= SLIP_CRITICAL) return 'text-critical';
  if (s >= SLIP_WARNING) return 'text-warning';
  return 'text-ink';
};

// Hover-revealed per-wheel detail layer for the instrument cluster. It is
// pointer-events-none so it never affects hit-testing — the parent section's
// group-hover drives visibility on desktop, keeping the reveal click/focus-
// free (a click would steal input focus from the game). On touch the parent's
// tap toggle drives `open` instead; staying pointer-events-none means the
// dismissing tap lands on the parent section too.
export const TyreOverlay = ({
  telemetry,
  open,
}: {
  telemetry: TelemetryFrame | null;
  open: boolean;
}) => (
  <div
    className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-page/85 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 ${
      open ? 'opacity-100' : 'opacity-0'
    }`}
  >
    <div>
      <p className="mb-2 text-center text-xs tracking-wide text-ink-muted uppercase">
        Tyres · slip / load
      </p>
      <div className="grid grid-cols-2 gap-2">
        {WHEEL_LABELS.map((label, i) => (
          <div key={label} className="w-28 rounded-lg border border-edge bg-surface px-3 py-2">
            <p className="text-[0.65rem] tracking-wide text-ink-muted uppercase">{label}</p>
            <p
              className={`text-lg font-semibold tabular-nums ${slipClass(
                telemetry?.tyreSlip[i] ?? 0,
              )}`}
            >
              {(telemetry?.tyreSlip[i] ?? 0).toFixed(2)}
            </p>
            <p className="text-xs tabular-nums text-ink-secondary">
              {((telemetry?.wheelLoad[i] ?? 0) / 1000).toFixed(1)} kN
            </p>
          </div>
        ))}
      </div>
    </div>
  </div>
);
