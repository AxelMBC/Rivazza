// Mirrors bridge/src/types.ts — keep the two in sync.
export type SessionInfo = {
  track: string;
  trackConfig: string;
  car: string;
  driver: string;
  // Image + bounds metadata both found.
  mapAvailable: boolean;
  // Bounds metadata (data/map.ini) found — enough to scale the map view.
  boundsAvailable: boolean;
  // Track-edge polylines resolved from ai/fast_lane.ai.
  edgesAvailable: boolean;
  // Car's advertised top speed in km/h (from ui_car.json), or null when
  // unavailable — the speedometer scale is derived from it, else falls back.
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

export type BridgeMessage =
  | { type: 'status'; state: 'waiting' | 'connected' }
  | ({ type: 'session' } & SessionInfo)
  | ({ type: 'telemetry' } & TelemetryFrame);

export type MapMeta = {
  width: number;
  height: number;
  xOffset: number;
  zOffset: number;
  scaleFactor: number;
};

// Track limits from the AI spline's per-point side distances: one polyline
// per track edge, [x, z] world-meter pairs (cm precision). `closed` marks a
// circuit loop; open splines (hillclimbs) get no closing segment.
export type TrackEdges = {
  closed: boolean;
  left: [number, number][];
  right: [number, number][];
};

export type ConnectionStatus = 'connecting' | 'waiting' | 'connected';
