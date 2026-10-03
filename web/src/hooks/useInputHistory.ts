import type { TelemetryFrame } from "@rivazza/protocol";
import { useEffect, useRef } from "react";

export type InputSample = {
  t: number;
  lateralG: number;
  longitudinalG: number;
};

const SMOOTHING_MS = 50;
// ~2 s at the ~30 Hz React state rate.
const CAPACITY = 60;

export const useInputHistory = (
  telemetry: TelemetryFrame | null,
): React.RefObject<InputSample[]> => {
  const historyRef = useRef<InputSample[]>([]);

  useEffect(() => {
    if (!telemetry) {
      historyRef.current = [];
      return;
    }
    const history = historyRef.current;
    const t = performance.now();
    const prev = history[history.length - 1];
    const alpha = prev ? 1 - Math.exp(-(t - prev.t) / SMOOTHING_MS) : 1;
    history.push({
      t,
      lateralG: prev
        ? prev.lateralG + alpha * (telemetry.accGHorizontal - prev.lateralG)
        : telemetry.accGHorizontal,
      longitudinalG: prev
        ? prev.longitudinalG +
          alpha * (telemetry.accGFrontal - prev.longitudinalG)
        : telemetry.accGFrontal,
    });
    if (history.length > CAPACITY) history.shift();
  }, [telemetry]);

  return historyRef;
};
