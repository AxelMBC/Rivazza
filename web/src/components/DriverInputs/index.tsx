import type { TelemetryFrame } from "@rivazza/protocol";

import type { InputSample } from "../../hooks/useInputHistory";

import { GForceMeter } from "./GForceMeter";
import { SteeringBar } from "./SteeringBar";

export const DriverInputs = ({
  telemetry,
  historyRef,
  className = "",
}: {
  telemetry: TelemetryFrame | null;
  historyRef: React.RefObject<InputSample[]>;
  className?: string;
}) => (
  <div className={`[container-type:size] ${className}`}>
    <section className="flex h-full flex-col justify-center gap-4 rounded-lg border border-edge bg-surface p-4">
      <div className="flex min-h-0 flex-1 flex-col [@container(max-height:160px)]:hidden">
        <GForceMeter historyRef={historyRef} />
      </div>
      <SteeringBar telemetry={telemetry} />
    </section>
  </div>
);
