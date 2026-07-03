import { useEffect, useRef } from 'react';
import type { TelemetryFrame } from '../types';

type LapSample = { pos: number; timeMs: number };

// Recording must span the lap for it to become the delta reference —
// rejects out-laps and sessions joined mid-lap.
const COVERAGE_START = 0.05;
const COVERAGE_END = 0.95;

// Reference elapsed time at `pos`, linearly interpolated between the two
// bracketing samples. Assumes samples are sorted by pos (enforced on append).
const interpolate = (lap: LapSample[], pos: number): number | null => {
  if (lap.length < 2 || pos < lap[0].pos || pos > lap[lap.length - 1].pos) return null;
  let lo = 0;
  let hi = lap.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lap[mid].pos <= pos) lo = mid;
    else hi = mid;
  }
  const a = lap[lo];
  const b = lap[hi];
  const span = b.pos - a.pos;
  if (span <= 0) return a.timeMs;
  return a.timeMs + ((pos - a.pos) / span) * (b.timeMs - a.timeMs);
};

// Records elapsed-time-vs-track-position for every lap driven while the app
// is open; the fastest complete lap becomes the reference, and the return
// value is the live delta to it (ms, negative = faster) or null before a
// reference exists. Bookkeeping happens in an effect and the result is read
// through a ref — the 30 Hz telemetry stream already re-renders consumers,
// so a one-frame lag is invisible and costs no extra renders.
export const useLapDelta = (telemetry: TelemetryFrame | null): number | null => {
  const recordingRef = useRef<LapSample[]>([]);
  const referenceRef = useRef<LapSample[] | null>(null);
  const referenceTimeRef = useRef<number>(Infinity);
  const lapCountRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const deltaRef = useRef<number | null>(null);

  useEffect(() => {
    if (!telemetry) {
      recordingRef.current = [];
      referenceRef.current = null;
      referenceTimeRef.current = Infinity;
      lapCountRef.current = null;
      lapTimeRef.current = 0;
      deltaRef.current = null;
      return;
    }

    const prevLap = lapCountRef.current;
    if (prevLap !== null && telemetry.lapCount > prevLap) {
      // Lap boundary: decide whether the finished recording becomes the reference.
      const finished = recordingRef.current;
      const covered =
        finished.length >= 2 &&
        finished[0].pos <= COVERAGE_START &&
        finished[finished.length - 1].pos >= COVERAGE_END;
      if (covered && telemetry.lastLapMs > 0 && telemetry.lastLapMs < referenceTimeRef.current) {
        referenceRef.current = finished;
        referenceTimeRef.current = telemetry.lastLapMs;
      }
      recordingRef.current = [];
    } else if (
      prevLap !== null &&
      (telemetry.lapCount < prevLap ||
        (telemetry.lapCount === prevLap && telemetry.lapTimeMs + 1000 < lapTimeRef.current))
    ) {
      // Session restart (lap counter or lap clock ran backwards): the
      // in-progress recording is garbage; the reference lap stays useful.
      recordingRef.current = [];
    }
    lapCountRef.current = telemetry.lapCount;
    lapTimeRef.current = telemetry.lapTimeMs;

    // Ignore position glitches — samples must stay monotonic within a lap.
    const recording = recordingRef.current;
    const last = recording[recording.length - 1];
    if (!last || telemetry.normalizedPos > last.pos) {
      recording.push({ pos: telemetry.normalizedPos, timeMs: telemetry.lapTimeMs });
    }

    const reference = referenceRef.current;
    if (!reference) {
      deltaRef.current = null;
      return;
    }
    const refTime = interpolate(reference, telemetry.normalizedPos);
    deltaRef.current = refTime === null ? null : telemetry.lapTimeMs - refTime;
  }, [telemetry]);

  return deltaRef.current;
};
