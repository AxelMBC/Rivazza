import type { MapMeta, TrafficLane } from "@rivazza/protocol";

import { insideMapBounds, roundCm } from "./mapBounds.js";

type TrafficLanesResult =
  | { ok: true; lanes: TrafficLane[] }
  | { ok: false; reason: "invalid" | "empty" | "out-of-bounds" };

const BOM = "\uFEFF";
const MIN_LANE_POINTS = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toPoint = (raw: unknown): [number, number] | null => {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const [x, y, z]: unknown[] = raw;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z))
    return null;
  return [roundCm(x), roundCm(z)];
};

// CSP publishes no schema for traffic.json; this reads the shape its traffic
// planner writes: { lanes: [{ loop, points: [[x, y, z], …], … }], … }.
const toLane = (raw: unknown): TrafficLane | null => {
  if (!isRecord(raw) || !Array.isArray(raw.points)) return null;
  const lane: TrafficLane = [];
  for (const rawPoint of raw.points) {
    const point = toPoint(rawPoint);
    if (!point) return null;
    lane.push(point);
  }
  if (lane.length < MIN_LANE_POINTS) return null;
  if (raw.loop === true) lane.push([lane[0][0], lane[0][1]]);
  return lane;
};

export const parseTrafficLanes = (
  text: string,
  meta: MapMeta | null,
): TrafficLanesResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.startsWith(BOM) ? text.slice(BOM.length) : text);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.lanes))
    return { ok: false, reason: "invalid" };
  const lanes = parsed.lanes.map(toLane).filter((lane) => lane !== null);
  if (lanes.length === 0) return { ok: false, reason: "empty" };
  if (meta && !insideMapBounds(lanes.flat(), meta))
    return { ok: false, reason: "out-of-bounds" };
  return { ok: true, lanes };
};
