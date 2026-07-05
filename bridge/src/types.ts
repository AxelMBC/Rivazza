export type SessionInfo = {
  track: string;
  trackConfig: string;
  car: string;
  driver: string;
  // Image + bounds metadata both found.
  mapAvailable: boolean;
  // Bounds metadata (data/map.ini) found — enough to scale the map view.
  boundsAvailable: boolean;
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
