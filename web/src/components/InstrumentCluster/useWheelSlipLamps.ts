import type { TelemetryFrame } from "@rivazza/protocol";
import { useState } from "react";

import { SLIP_OFF, SLIP_ON } from "./constants";

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
