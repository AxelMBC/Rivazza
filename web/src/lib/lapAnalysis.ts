import type { LapRecord } from "../hooks/useLapHistory";
import type {
  LapRecording,
  LapTelemetrySample,
} from "../hooks/useLapRecordings";

import { isPitLap } from "./lapStatus";

export const COVERAGE_START = 0.05;
export const COVERAGE_END = 0.95;

// AC's track assets carry no corner metadata, so the slices are equal; 8 puts a
// sector at ~600 m on a typical circuit, few enough to name on the map.
export const SECTOR_COUNT = 8;

export type ScrubPoint = {
  x: number;
  z: number;
  color: string;
  slice: number;
};

type PosTimed = { pos: number; timeMs: number };

const bracket = (samples: readonly PosTimed[], pos: number): number => {
  if (
    samples.length < 2 ||
    pos < samples[0].pos ||
    pos > samples[samples.length - 1].pos
  )
    return -1;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].pos <= pos) lo = mid;
    else hi = mid;
  }
  return lo;
};

export const interpolateTimeAt = (
  samples: readonly PosTimed[],
  pos: number,
): number | null => {
  const lo = bracket(samples, pos);
  if (lo < 0) return null;
  const a = samples[lo];
  const b = samples[lo + 1];
  const span = b.pos - a.pos;
  if (span <= 0) return a.timeMs;
  return a.timeMs + ((pos - a.pos) / span) * (b.timeMs - a.timeMs);
};

export const sampleNear = (
  samples: readonly LapTelemetrySample[],
  pos: number,
): LapTelemetrySample | null => {
  const lo = bracket(samples, pos);
  if (lo < 0) return null;
  const a = samples[lo];
  const b = samples[lo + 1];
  return pos - a.pos <= b.pos - pos ? a : b;
};

export const worldPointAt = (
  samples: readonly LapTelemetrySample[],
  pos: number,
): { x: number; z: number } | null => {
  const lo = bracket(samples, pos);
  if (lo < 0) return null;
  const a = samples[lo];
  const b = samples[lo + 1];
  const span = b.pos - a.pos;
  const f = span <= 0 ? 0 : (pos - a.pos) / span;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
};

export const latestComplete = (
  recordings: readonly LapRecording[],
): LapRecording | null => {
  for (let i = recordings.length - 1; i >= 0; i--)
    if (recordings[i].complete) return recordings[i];
  return null;
};

const notValidLapSet = (laps: readonly LapRecord[]): Set<number> =>
  new Set(laps.filter((l) => l.status !== "valid").map((l) => l.lap));

export const resolveReference = (
  recordings: readonly LapRecording[],
  laps: readonly LapRecord[],
): LapRecording | null => {
  const notValid = notValidLapSet(laps);
  let bestValid: LapRecording | null = null;
  for (const rec of recordings) {
    if (!rec.complete || rec.timeMs === null || notValid.has(rec.lap)) continue;
    if (bestValid === null || rec.timeMs < (bestValid.timeMs ?? Infinity))
      bestValid = rec;
  }
  return bestValid;
};

export const sectorTimes = (
  rec: LapRecording,
  count: number,
): (number | null)[] => {
  const samples = rec.samples;
  const startsAtLine = samples.length > 0 && samples[0].pos <= COVERAGE_START;
  const endsAtLine =
    samples.length > 0 && samples[samples.length - 1].pos >= COVERAGE_END;
  const bounds: (number | null)[] = [];
  for (let i = 0; i <= count; i++) {
    let t = interpolateTimeAt(samples, i / count);
    if (t === null) {
      if (i === 0 && startsAtLine) t = 0;
      else if (i === count && endsAtLine && rec.timeMs !== null) t = rec.timeMs;
    }
    bounds.push(t);
  }
  const slices: (number | null)[] = [];
  for (let i = 0; i < count; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    slices.push(a !== null && b !== null && b > a ? b - a : null);
  }
  return slices;
};

export const bestSectors = (
  recordings: readonly LapRecording[],
  laps: readonly LapRecord[],
  count: number,
): (number | null)[] => {
  const notValid = notValidLapSet(laps);
  const best: (number | null)[] = new Array<number | null>(count).fill(null);
  for (const rec of recordings) {
    if (rec.timeMs === null || notValid.has(rec.lap)) continue;
    sectorTimes(rec, count).forEach((t, i) => {
      const b = best[i];
      if (t !== null && (b === null || t < b)) best[i] = t;
    });
  }
  return best;
};

export type SectorOwner = { lap: number; timeMs: number; invalid: boolean };

export const sectorOwners = (
  recordings: readonly LapRecording[],
  laps: readonly LapRecord[],
  count: number,
): (SectorOwner | null)[] => {
  const statusByLap = new Map(laps.map((l) => [l.lap, l.status]));
  const owners = new Array<SectorOwner | null>(count).fill(null);
  for (const rec of recordings) {
    const status = statusByLap.get(rec.lap);
    if (rec.timeMs === null || isPitLap(status)) continue;
    const invalid = status === "invalid";
    sectorTimes(rec, count).forEach((t, i) => {
      const owner = owners[i];
      if (t !== null && (owner === null || t < owner.timeMs))
        owners[i] = { lap: rec.lap, timeMs: t, invalid };
    });
  }
  return owners;
};

export const theoreticalBestMs = (
  best: readonly (number | null)[],
): number | null => {
  let sum = 0;
  for (const t of best) {
    if (t === null) return null;
    sum += t;
  }
  return sum;
};
