// Shown only in demo builds (VITE_DEMO_MODE) so viewers know the telemetry is a
// recorded replay, not a live session. Absent in normal builds — see lib/demo.ts.
export const DemoBadge = () => (
  <span className="flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm">
    <span className="size-2 rounded-full bg-accent" />
    <span className="text-accent">Demo replay</span>
  </span>
);
