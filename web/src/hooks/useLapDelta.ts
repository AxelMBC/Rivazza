import type { TelemetryFrame } from "@rivazza/protocol";
import { useEffect, useRef } from "react";

import {
  COVERAGE_END,
  COVERAGE_START,
  interpolateTimeAt,
} from "../lib/lapAnalysis";

type LapSample = { pos: number; timeMs: number };

export const useLapDelta = (
  telemetry: TelemetryFrame | null,
): number | null => {
  const recordingRef = useRef<LapSample[]>([]);
  const referenceRef = useRef<LapSample[] | null>(null);
  const referenceTimeRef = useRef<number>(Infinity);
  const lapCountRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const deltaRef = useRef<number | null>(null);
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
    const lapTicked = prevLap !== null && telemetry.lapCount > prevLap;
    const restarted =
      prevLap !== null &&
      (telemetry.lapCount < prevLap ||
        (telemetry.lapCount === prevLap &&
          telemetry.lapTimeMs + 1000 < lapTimeRef.current));
    if (lapTicked) {
      const finished = wrappedRef.current ?? recordingRef.current;
      wrappedRef.current = null;
      const covered =
        finished.length >= 2 &&
        finished[0].pos <= COVERAGE_START &&
        finished[finished.length - 1].pos >= COVERAGE_END;
      if (
        covered &&
        telemetry.lastLapMs > 0 &&
        telemetry.lastLapMs < referenceTimeRef.current
      ) {
        referenceRef.current = finished;
        referenceTimeRef.current = telemetry.lastLapMs;
      }
      if (finished === recordingRef.current) recordingRef.current = [];
    } else if (restarted) {
      recordingRef.current = [];
      wrappedRef.current = null;
    }
    lapCountRef.current = telemetry.lapCount;
    lapTimeRef.current = telemetry.lapTimeMs;

    let recording = recordingRef.current;
    const newest = recording[recording.length - 1];
    const jumpedBackwardsWithoutTick =
      newest !== undefined && telemetry.normalizedPos < newest.pos - 0.5;
    if (jumpedBackwardsWithoutTick) {
      const spansLap =
        recording.length >= 2 &&
        recording[0].pos <= COVERAGE_START &&
        newest.pos >= COVERAGE_END;
      wrappedRef.current = spansLap ? recording : null;
      recordingRef.current = [];
      recording = recordingRef.current;
    }

    const last = recording[recording.length - 1];
    if (!last || telemetry.normalizedPos > last.pos) {
      recording.push({
        pos: telemetry.normalizedPos,
        timeMs: telemetry.lapTimeMs,
      });
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
