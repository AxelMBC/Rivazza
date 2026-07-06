import fs from 'node:fs';
import type { MapMeta, TrackEdges } from './types.js';

// ai/fast_lane.ai is AC's AI spline: little-endian, header of four int32s
// (version == 7, point count, lap time, sample count), then count 20-byte
// points { float x, y, z, length; int32 id }, then an int32 extra-record
// count (must equal the point count), then count 72-byte extra records of
// 18 floats where float [5] is sideLeft and [6] is sideRight — the measured
// distances from the spline to the track edges. A grid lookup section
// follows; it is ignored. Same garbage-tolerant philosophy as parsers.ts:
// bad content never throws, it just yields no edges.
const AI_VERSION = 7;
const HEADER_SIZE = 16;
const POINT_SIZE = 20;
const EXTRA_SIZE = 72;
const SIDE_LEFT_OFFSET = 5 * 4;
const SIDE_RIGHT_OFFSET = 6 * 4;

const MAX_SIDE = 50; // m — hard clamp against garbage side values
const MIN_POINTS = 50; // fewer can't describe a track (drift ships a 12-byte stub)
const MIN_USABLE_RATIO = 0.7; // points that must have a positive track width
const MIN_IN_BOUNDS_RATIO = 0.8; // spline points that must sit inside the map.ini world rect
const BOUNDS_MARGIN = 0.1; // slack around the map.ini rect for the cross-check
const CLOSED_GAP = 30; // m — endpoints closer than this make a closed loop
const MIN_WIDTH = 0.5; // m — below this a point counts as width-less

type SplinePoint = { x: number; z: number; sideLeft: number; sideRight: number };

// Median-of-3 kills isolated one-point spikes in the side data without
// flattening genuinely wide sections (drag strips, merge areas).
const median3 = (values: number[]): number[] =>
  values.map((v, i) => {
    const a = values[Math.max(0, i - 1)];
    const c = values[Math.min(values.length - 1, i + 1)];
    return Math.max(Math.min(a, v), Math.min(Math.max(a, v), c));
  });

const roundCm = (v: number): number => Math.round(v * 100) / 100;

const parseSpline = (buf: Buffer): SplinePoint[] | null => {
  if (buf.length < HEADER_SIZE) return null;
  const version = buf.readInt32LE(0);
  const count = buf.readInt32LE(4);
  if (version !== AI_VERSION || count < MIN_POINTS) return null;
  const extraCountOffset = HEADER_SIZE + count * POINT_SIZE;
  if (buf.length < extraCountOffset + 4 + count * EXTRA_SIZE) return null;
  if (buf.readInt32LE(extraCountOffset) !== count) return null;

  const points: SplinePoint[] = new Array(count);
  const lefts: number[] = new Array(count);
  const rights: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const p = HEADER_SIZE + i * POINT_SIZE;
    const e = extraCountOffset + 4 + i * EXTRA_SIZE;
    const clamp = (v: number) => (Number.isFinite(v) ? Math.min(MAX_SIDE, Math.max(0, v)) : 0);
    lefts[i] = clamp(buf.readFloatLE(e + SIDE_LEFT_OFFSET));
    rights[i] = clamp(buf.readFloatLE(e + SIDE_RIGHT_OFFSET));
    points[i] = { x: buf.readFloatLE(p), z: buf.readFloatLE(p + 8), sideLeft: 0, sideRight: 0 };
    if (!Number.isFinite(points[i].x) || !Number.isFinite(points[i].z)) return null;
  }
  const smoothLeft = median3(lefts);
  const smoothRight = median3(rights);
  for (let i = 0; i < count; i++) {
    points[i].sideLeft = smoothLeft[i];
    points[i].sideRight = smoothRight[i];
  }
  return points;
};

// A mod track can ship a fast_lane.ai copied verbatim from another track;
// its coordinates then live in a different world region than the map.
const insideMapBounds = (points: SplinePoint[], meta: MapMeta): boolean => {
  const spanX = meta.width * meta.scaleFactor;
  const spanZ = meta.height * meta.scaleFactor;
  const minX = -meta.xOffset - spanX * BOUNDS_MARGIN;
  const maxX = -meta.xOffset + spanX * (1 + BOUNDS_MARGIN);
  const minZ = -meta.zOffset - spanZ * BOUNDS_MARGIN;
  const maxZ = -meta.zOffset + spanZ * (1 + BOUNDS_MARGIN);
  let inside = 0;
  for (const p of points) {
    if (p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ) inside++;
  }
  return inside / points.length >= MIN_IN_BOUNDS_RATIO;
};

export const resolveTrackEdges = (aiPath: string, meta: MapMeta | null): TrackEdges | null => {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(aiPath);
  } catch {
    return null;
  }
  const points = parseSpline(buf);
  if (!points) {
    console.warn(`[edges] ${aiPath} is not a usable AI spline`);
    return null;
  }
  const usable = points.filter((p) => p.sideLeft + p.sideRight > MIN_WIDTH).length;
  if (usable / points.length < MIN_USABLE_RATIO) {
    console.warn(`[edges] ${aiPath} has no side data (${usable}/${points.length} points with width)`);
    return null;
  }
  if (meta && !insideMapBounds(points, meta)) {
    console.warn(`[edges] ${aiPath} does not fit this track's map bounds — likely copied from another track`);
    return null;
  }

  const n = points.length;
  const first = points[0];
  const last = points[n - 1];
  const closed = Math.hypot(first.x - last.x, first.z - last.z) < CLOSED_GAP;

  const left: [number, number][] = new Array(n);
  const right: [number, number][] = new Array(n);
  // Driver-left in world XZ is (dz, -dx) for unit travel direction (dx, dz);
  // validated empirically (racing lines hug the inside edge at apexes).
  let dx = 1;
  let dz = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = closed || i < n - 1 ? points[(i + 1) % n] : p;
    const segX = q.x - p.x;
    const segZ = q.z - p.z;
    const len = Math.hypot(segX, segZ);
    if (len > 1e-6) {
      dx = segX / len;
      dz = segZ / len;
    }
    left[i] = [roundCm(p.x + dz * p.sideLeft), roundCm(p.z - dx * p.sideLeft)];
    right[i] = [roundCm(p.x - dz * p.sideRight), roundCm(p.z + dx * p.sideRight)];
  }
  return { closed, left, right };
};
