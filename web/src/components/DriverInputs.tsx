import type { InputSample } from "../hooks/useInputHistory";
import type { TelemetryFrame } from "../types";

import { GForceMeter } from "./GForceMeter";
import { PedalBars } from "./PedalBars";

export const DriverInputs = ({
  telemetry,
  historyRef,
  className = "",
}: {
  telemetry: TelemetryFrame | null;
  historyRef: React.RefObject<InputSample[]>;
  className?: string;
}) => (
  <section
    className={`grid grid-cols-[1fr_auto] grid-rows-1 gap-4 rounded-lg border border-edge bg-surface p-4 ${className}`}
  >
    <GForceMeter historyRef={historyRef} />
    <PedalBars telemetry={telemetry} />
  </section>
);
