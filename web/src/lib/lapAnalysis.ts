import type { LapRecord } from '../hooks/useLapHistory';
import type { LapRecording, LapTelemetrySample } from '../hooks/useLapRecordings';

// A recording must span the lap to count as complete or become the delta
// reference — rejects out-laps and sessions joined mid-lap.
export const COVERAGE_START = 0.05;
export const COVERAGE_END = 0.95;

// Fixed equal normalized-position slices. No corner metadata exists in the
// assets the bridge reads, so equal micro-sectors (the sim-timing-tool
// convention) are as good as any segmentation; 24 keeps a corner at ~1–2
// slices on a typical track.
export const SECTOR_COUNT = 24;
// A sector this close to the session best reads as "matched", not "slower".
export const SECTOR_TOLERANCE_MS = 50;

// Scrub handoff from the analysis panel to the track map: world point on the
// selected lap's line plus that lap's identity color. Shared as a ref (the
// hoveredLapRef pattern) so neither side render-couples to the other.
export type ScrubPoint = { x: number; z: number; color: string };

type PosTimed = { pos: number; timeMs: number };

// Bracketing index for `pos`: the largest i with samples[i].pos <= pos,
// requiring samples[i + 1] to exist. Samples are sorted by pos (appends are
// monotonic-guarded). Returns -1 when pos falls outside the sampled span.
const bracket = (samples: readonly PosTimed[], pos: number): number => {
  if (samples.length < 2 || pos < samples[0].pos || pos > samples[samples.length - 1].pos)
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

// Elapsed lap time at `pos`, linearly interpolated between the two bracketing
// samples, or null when the recording doesn't cover that position.
export const interpolateTimeAt = (samples: readonly PosTimed[], pos: number): number | null => {
  const lo = bracket(samples, pos);
  if (lo < 0) return null;
  const a = samples[lo];
  const b = samples[lo + 1];
  const span = b.pos - a.pos;
  if (span <= 0) return a.timeMs;
  return a.timeMs + ((pos - a.pos) / span) * (b.timeMs - a.timeMs);
};

// Nearest recorded sample to `pos` — for readouts of stepwise fields (gear,
// pedal state) that must never be blended between samples.
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

// World point on the lap line at `pos`, linearly interpolated — where the
// track map draws the scrub marker.
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

const invalidLapSet = (laps: readonly LapRecord[]): Set<number> =>
  new Set(laps.filter((l) => l.invalid).map((l) => l.lap));

// The comparison baseline: strictly the fastest valid complete recording.
// An invalid lap must never stand in as "best"/reference — better to show
// no delta than to compare against a lap the game rejected.
export const resolveReference = (
  recordings: readonly LapRecording[],
  laps: readonly LapRecord[],
): LapRecording | null => {
  const invalid = invalidLapSet(laps);
  let bestValid: LapRecording | null = null;
  for (const rec of recordings) {
    if (!rec.complete || rec.timeMs === null || invalid.has(rec.lap)) continue;
    if (bestValid === null || rec.timeMs < (bestValid.timeMs ?? Infinity)) bestValid = rec;
  }
  return bestValid;
};

// Per-slice times from interpolated boundary crossings. The 0.0 boundary is
// pinned to 0 ms (and 1.0 to the lap time) only when the recording genuinely
// starts (ends) at the line — sampling never lands exactly on the boundary,
// and without the pin the first and last slices would never resolve. Slices
// the recording doesn't cover yield null, never a fabricated time.
export const sectorTimes = (rec: LapRecording, count: number): (number | null)[] => {
  const samples = rec.samples;
  const bounds: (number | null)[] = [];
  for (let i = 0; i <= count; i++) {
    let t = interpolateTimeAt(samples, i / count);
    if (t === null && samples.length > 0) {
      if (i === 0 && samples[0].pos <= COVERAGE_START) t = 0;
      else if (i === count && rec.timeMs !== null && samples[samples.length - 1].pos >= COVERAGE_END)
        t = rec.timeMs;
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

// Best time per slice across valid completed laps only — a cut lap must not
// own a best sector. Partial (non-complete) recordings still contribute the
// slices they genuinely covered.
export const bestSectors = (
  recordings: readonly LapRecording[],
  laps: readonly LapRecord[],
  count: number,
): (number | null)[] => {
  const invalid = invalidLapSet(laps);
  const best: (number | null)[] = new Array<number | null>(count).fill(null);
  for (const rec of recordings) {
    if (rec.timeMs === null || invalid.has(rec.lap)) continue;
    sectorTimes(rec, count).forEach((t, i) => {
      const b = best[i];
      if (t !== null && (b === null || t < b)) best[i] = t;
    });
  }
  return best;
};

// Sum of the per-slice bests — only once every slice has a valid time, so a
// partial table never shows a fabricated optimal lap.
export const theoreticalBestMs = (best: readonly (number | null)[]): number | null => {
  let sum = 0;
  for (const t of best) {
    if (t === null) return null;
    sum += t;
  }
  return sum;
};
