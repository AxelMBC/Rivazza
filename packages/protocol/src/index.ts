export type SessionInfo = {
  track: string;
  trackConfig: string;
  car: string;
  driver: string;
  mapAvailable: boolean;
  boundsAvailable: boolean;
  edgesAvailable: boolean;
  topSpeedKmh: number | null;
};

export type TelemetryFrame = {
  speedKmh: number;
  gear: number;
  rpm: number;
  lapTimeMs: number;
  lastLapMs: number;
  bestLapMs: number;
  lapCount: number;
  gas: number;
  brake: number;
  clutch: number;
  steerAngle: number;
  accGFrontal: number;
  accGHorizontal: number;
  accGVertical: number;
  absEnabled: boolean;
  absInAction: boolean;
  tcEnabled: boolean;
  tcInAction: boolean;
  inPit: boolean;
  engineLimiterOn: boolean;
  carSlope: number;
  // Wheel arrays are ordered FL, FR, RL, RR.
  tyreSlip: number[];
  wheelLoad: number[];
  normalizedPos: number;
  x: number;
  y: number;
  z: number;
};

// `lapCount` is AC's raw counter; the display convention is that lapCount N is "Lap N+1".
export type CutEvent = {
  lapCount: number;
  lapTimeMs: number;
  x: number;
  z: number;
  speedKmh: number;
  tyresOut: number;
};

export type BridgeMessage =
  | { type: "status"; state: "waiting" | "connected" }
  | ({ type: "session" } & SessionInfo)
  | ({ type: "telemetry" } & TelemetryFrame)
  | ({ type: "cut" } & CutEvent);

export type MapMeta = {
  width: number;
  height: number;
  xOffset: number;
  zOffset: number;
  scaleFactor: number;
};

export type TrackEdges = {
  closed: boolean;
  left: [number, number][];
  right: [number, number][];
  // Normalized track position (0-1) of each vertex, index-aligned with `left` and `right`.
  pos: number[];
};
