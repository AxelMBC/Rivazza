import { useEffect, useRef } from 'react';
import type { TelemetryFrame } from '../types';

export type InputSample = {
  t: number; // performance.now() at capture, ms
  gas: number;
  brake: number;
  clutch: number;
  accGH: number; // lateral G
  accGF: number; // longitudinal G
};

const CAPACITY = 360; // ~12s of samples at 30 Hz

// Ring buffer of recent driver inputs, exposed as a ref so canvas components
// (pedal trace, G-meter) can read it from requestAnimationFrame loops without
// re-render coupling — same pattern as telemetryRef.
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
      accGH: telemetry.accGHorizontal,
      accGF: telemetry.accGFrontal,
    });
    if (history.length > CAPACITY) history.shift();
  }, [telemetry]);

  return historyRef;
};
