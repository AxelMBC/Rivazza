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

export type HandshakerResponse = {
  carName: string;
  driverName: string;
  identifier: number;
  version: number;
  trackName: string;
  trackConfig: string;
};

export type MapMeta = {
  width: number;
  height: number;
  xOffset: number;
  zOffset: number;
  scaleFactor: number;
};

// Edge polylines as [x, z] world-meter pairs. `closed` marks a circuit loop;
// open splines (hillclimbs) get no closing segment.
export type TrackEdges = {
  closed: boolean;
  left: [number, number][];
  right: [number, number][];
  // Normalized track position (0-1) of each vertex, index-aligned one-to-one
  // with `left` and `right` — the AI spline's own points, so a normalized
  // position resolves onto real track geometry instead of a driven line.
  pos: number[];
};
