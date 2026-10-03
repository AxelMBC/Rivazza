import type { TelemetryFrame } from "@rivazza/protocol";
import { useState } from "react";

// Normalised slip peaks at ~1; cornering at the limit reads 0.6–1.0, so the
// off point sits below that band or a lamp flickers through the corner.
export const SLIP_ON = 1.2;
const SLIP_OFF = 0.9;
export const SLIP_CRITICAL = 3;

// Index order must match the tyreSlip / wheelLoad arrays.
export const WHEEL_LABELS = ["FL", "FR", "RL", "RR"] as const;

type WheelLamps = readonly boolean[];

const DARK: WheelLamps = [false, false, false, false];

const nextLamps = (lit: WheelLamps, slip: number[]): WheelLamps => {
  const next = slip.map((s, i) => s >= SLIP_ON || (lit[i] && s > SLIP_OFF));
  return next.every((on, i) => on === lit[i]) ? lit : next;
};

export const useWheelSlipLamps = (
  telemetry: TelemetryFrame | null,
): WheelLamps => {
  const [lit, setLit] = useState(DARK);
  const next = telemetry ? nextLamps(lit, telemetry.tyreSlip) : DARK;
  if (next !== lit) setLit(next);
  return next;
};
