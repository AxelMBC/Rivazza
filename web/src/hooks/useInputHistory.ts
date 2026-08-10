import { useEffect, useRef } from "react";

import type { TelemetryFrame } from "../types";

export type InputSample = {
  t: number; // performance.now() at capture, ms
  gas: number;
  brake: number;
  clutch: number;
  lateralG: number;
  longitudinalG: number;
};

const CAPACITY = 360; // ~12s of samples at the ~30 Hz React state rate (see useTelemetry)

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
    history.push({
      t: performance.now(),
      gas: telemetry.gas,
      brake: telemetry.brake,
      clutch: telemetry.clutch,
      lateralG: telemetry.accGHorizontal,
      longitudinalG: telemetry.accGFrontal,
    });
    if (history.length > CAPACITY) history.shift();
  }, [telemetry]);

  return historyRef;
};
