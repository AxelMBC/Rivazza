import { useEffect, useRef } from 'react';
import type { TelemetryFrame } from '../types';
import { COVERAGE_START, COVERAGE_END, interpolateTimeAt } from '../lib/lapAnalysis';

type LapSample = { pos: number; timeMs: number };

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
  // A full-lap recording that rolled over at the finish line while lapCount
  // hadn't incremented yet (AC reports the position wrap a frame or two
  // before the counter) — held for the imminent tick.
  const wrappedRef = useRef<LapSample[] | null>(null);

  useEffect(() => {
    if (!telemetry) {
      recordingRef.current = [];
      referenceRef.current = null;
      referenceTimeRef.current = Infinity;
      lapCountRef.current = null;
      lapTimeRef.current = 0;
      deltaRef.current = null;
      wrappedRef.current = null;
      return;
    }

    const prevLap = lapCountRef.current;
    if (prevLap !== null && telemetry.lapCount > prevLap) {
      // Lap boundary: decide whether the finished recording becomes the
      // reference. When the recording already rolled over at the line
      // (wrappedRef), the held one is the finished lap and the current
      // recording is already the new lap — keep it accumulating.
      const finished = wrappedRef.current ?? recordingRef.current;
      wrappedRef.current = null;
      const covered =
        finished.length >= 2 &&
        finished[0].pos <= COVERAGE_START &&
        finished[finished.length - 1].pos >= COVERAGE_END;
      if (covered && telemetry.lastLapMs > 0 && telemetry.lastLapMs < referenceTimeRef.current) {
        referenceRef.current = finished;
        referenceTimeRef.current = telemetry.lastLapMs;
      }
      if (finished === recordingRef.current) recordingRef.current = [];
    } else if (
      prevLap !== null &&
      (telemetry.lapCount < prevLap ||
        (telemetry.lapCount === prevLap && telemetry.lapTimeMs + 1000 < lapTimeRef.current))
    ) {
      // Session restart (lap counter or lap clock ran backwards): the
      // in-progress recording is garbage; the reference lap stays useful.
      recordingRef.current = [];
      wrappedRef.current = null;
    }
    lapCountRef.current = telemetry.lapCount;
    lapTimeRef.current = telemetry.lapTimeMs;

    // A large backwards jump without a lap tick: either the finish-line
    // crossing of a completed lap whose tick hasn't arrived yet (hold the
    // full-lap recording for it), or an out-lap's first line crossing /
    // teleport whose pre-line samples belong to no lap (discard — they'd
    // otherwise block the whole first flying lap via the monotonic guard
    // below). Either way the recording restarts at the line.
    let recording = recordingRef.current;
    const newest = recording[recording.length - 1];
    if (newest && telemetry.normalizedPos < newest.pos - 0.5) {
      const spansLap =
        recording.length >= 2 &&
        recording[0].pos <= COVERAGE_START &&
        newest.pos >= COVERAGE_END;
      wrappedRef.current = spansLap ? recording : null;
      recordingRef.current = [];
      recording = recordingRef.current;
    }

    // Ignore position glitches — samples must stay monotonic within a lap.
    const last = recording[recording.length - 1];
    if (!last || telemetry.normalizedPos > last.pos) {
      recording.push({ pos: telemetry.normalizedPos, timeMs: telemetry.lapTimeMs });
    }

    const reference = referenceRef.current;
    if (!reference) {
      deltaRef.current = null;
      return;
    }
    const refTime = interpolateTimeAt(reference, telemetry.normalizedPos);
    deltaRef.current = refTime === null ? null : telemetry.lapTimeMs - refTime;
  }, [telemetry]);

  return deltaRef.current;
};
