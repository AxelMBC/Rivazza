import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";
import { useEffect, useRef } from "react";

export type LapRecord = {
  lap: number;
  timeMs: number;
  invalid: boolean;
};

type PendingLap = {
  lap: number;
  pitDuring: boolean;
  cutDuring: boolean;
  bestBefore: number;
  lastLapBefore: number;
  framesWaited: number;
};

// Back-to-back identical lap times never visibly refresh lastLapMs.
const PENDING_MAX_FRAMES = 3;

export type LapHistory = {
  lapsRef: React.RefObject<LapRecord[]>;
  currentLapInvalidRef: React.RefObject<boolean>;
};

export const useLapHistory = (
  telemetry: TelemetryFrame | null,
  cutsRef: React.RefObject<CutEvent[]>,
  cutSeq: number,
): LapHistory => {
  const lapsRef = useRef<LapRecord[]>([]);
  const lapCountRef = useRef<number | null>(null);
  const lapTimeRef = useRef(0);
  const prevBestRef = useRef(0);
  const prevLastRef = useRef(0);
  const pitDuringRef = useRef(false);
  const pendingRef = useRef<PendingLap | null>(null);
  const cutDuringRef = useRef(false);
  const consumedCutsRef = useRef(0);
  const seenCutsRef = useRef<CutEvent[] | null>(null);

  useEffect(() => {
    const cuts = cutsRef.current;
    if (cuts !== seenCutsRef.current) {
      seenCutsRef.current = cuts;
      consumedCutsRef.current = 0;
    }

    if (!telemetry) {
      lapsRef.current = [];
      lapCountRef.current = null;
      lapTimeRef.current = 0;
      prevBestRef.current = 0;
      prevLastRef.current = 0;
      pitDuringRef.current = false;
      pendingRef.current = null;
      cutDuringRef.current = false;
      return;
    }

    const prevLap = lapCountRef.current;
    const restarted =
      prevLap !== null &&
      (telemetry.lapCount < prevLap ||
        (telemetry.lapCount === prevLap &&
          telemetry.lapTimeMs + 1000 < lapTimeRef.current));

    if (restarted) {
      lapsRef.current = [];
      pitDuringRef.current = false;
      pendingRef.current = null;
      cutDuringRef.current = false;
      consumedCutsRef.current = cuts.length;
    } else if (prevLap !== null && telemetry.lapCount > prevLap) {
      pendingRef.current = {
        lap: prevLap + 1,
        pitDuring: pitDuringRef.current,
        cutDuring: cutDuringRef.current,
        bestBefore: prevBestRef.current,
        lastLapBefore: prevLastRef.current,
        framesWaited: 0,
      };
      pitDuringRef.current = false;
      cutDuringRef.current = false;
    }

    for (; consumedCutsRef.current < cuts.length; consumedCutsRef.current++) {
      const cut = cuts[consumedCutsRef.current];
      if (cut.lapCount === telemetry.lapCount) {
        cutDuringRef.current = true;
      } else if (
        pendingRef.current &&
        cut.lapCount + 1 === pendingRef.current.lap
      ) {
        pendingRef.current.cutDuring = true;
      }
    }

    const pending = pendingRef.current;
    if (pending) {
      const fresh =
        telemetry.lastLapMs > 0 &&
        (telemetry.lastLapMs !== pending.lastLapBefore ||
          pending.framesWaited >= PENDING_MAX_FRAMES);
      if (fresh) {
        const timeMs = telemetry.lastLapMs;
        const wouldBeBest =
          pending.bestBefore <= 0 || timeMs < pending.bestBefore;
        const rejected = wouldBeBest && telemetry.bestLapMs !== timeMs;
        lapsRef.current.push({
          lap: pending.lap,
          timeMs,
          invalid: pending.pitDuring || pending.cutDuring || rejected,
        });
        pendingRef.current = null;
      } else {
        pending.framesWaited += 1;
      }
    }

    pitDuringRef.current = pitDuringRef.current || telemetry.inPit;
    lapCountRef.current = telemetry.lapCount;
    lapTimeRef.current = telemetry.lapTimeMs;
    prevBestRef.current = telemetry.bestLapMs;
    prevLastRef.current = telemetry.lastLapMs;
  }, [telemetry, cutsRef, cutSeq]);

  return { lapsRef, currentLapInvalidRef: cutDuringRef };
};
